/**
 * Script file: index.js
 * Created on: Feb 28, 2018
 * Last modified on: Mar 31, 2021
 *
 * Comments:
 *  Raspberry Pi relay controller homebridge plugin
 */

//var rpio = require('rpio');
let Service, Characteristic;
var i2c = require('raspi-i2c');

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-relays-i2c", "Relay", RelayAccessory);
}

class RelayAccessory {
    constructor(log, config) {
        /* log instance */
        this.log = log;

        /* read configuration */
        this.name = config.name;
        //this.pin = config.pin;
        this.i2cAddress = parseInt(config.i2cAddress);
        this.i2cRegister = parseInt(config.i2cRegister);
        this.i2cDevice = config.i2cDevice || '/dev/i2c-1';
        this.invert = config.invert || false;
        this.initialState = config.initial_state || 0;
        this.timeout = config.timeout_ms || 0;

        /* initialize variables */
        this.timerId = -1;

        /* GPIO initialization */
        //rpio.open(this.pin, rpio.OUTPUT, this.gpioValue(this.initialState));

        this.cache = {
        'state': false
        };

        this.wire = new i2c(this.i2cAddress, {
            device: this.i2cDevice
        });

        /* run service */
        this.relayService = new Service.Switch(this.name);
    }

    identify(callback) {
        this.log.debug("Accessory identified");
        callback(null);
    }

    gpioValue(val) {
        if (this.invert) {
            val = !val;
        }
        return val ? rpio.HIGH : rpio.LOW;
    }

    getRelayState() {
        /* get relay state (ON, OFF) */
        var val = this.cache.state;
        return val;
    }

    setRelayState(value) {
        /* clear timeout if already exists */
        if (this.timerId !== -1) {
            clearTimeout(this.timerId);
            this.timerId = -1;
        }

        /* GPIO write operation */
        this.log.debug("Adress %d status: %s", this.i2cAddress, value);
        //rpio.write(this.pin, this.gpioValue(value));
        if (value != 0) {
          this.wire.writeBytes(i2cAddress,i2cRegister,0xFF);
          this.cache.state = 1;
        } else {
          this.wire.writeBytes(i2cAddress,i2cRegister,0x00);
          this.cache.state = 0;
        }
        /* turn off the relay if timeout is expired */
        if (value && this.timeout > 0) {
            this.timerId = setTimeout(() => {
                this.log.debug("Pin %d timed out. Turned off", this.pin);
                this.cache.state = 0;
                //rpio.write(this.pin, this.gpioValue(false));
                this.wire.writeBytes(i2cAddress,i2cRegister,0x00);
                this.timerId = -1;

                /* update relay status */
                this.relayService
                    .getCharacteristic(Characteristic.On)
                    .updateValue(false);
            }, this.timeout);
        }
    }

    getServices() {
        this.informationService = new Service.AccessoryInformation();
        this.informationService
            //.setCharacteristic(Characteristic.Manufacturer, 'Smart Technology')
            .setCharacteristic(Characteristic.Manufacturer, 'Westley Davis')
            //.setCharacteristic(Characteristic.Model, 'Multi-Relay Controller');
            .setCharacteristic(Characteristic.Model, 'I2C Multi-Relay Controller');

        /* relay control */
        this.relayService
            .getCharacteristic(Characteristic.On)
            .on('get', callback => {
                this.state = this.getRelayState();
                this.log.debug("Status:", this.state ? "ON" : "OFF");
                callback(null, this.state);
            })
            .on('set', (value, callback) => {
                this.setRelayState(value);
                callback(null);
            });

        return [this.informationService, this.relayService];
    }
}
