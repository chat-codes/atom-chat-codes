'use babel';

const $ = require('jquery');
const _ = require('underscore');
const EventEmitter = require('events');
const Terminal = require('xterm');

const pty = require('pty.js');

export class TerminalView extends EventEmitter {
    constructor(channelService) {
        super();

        this.term = pty.spawn('bash', [], {
            name: 'xterm-color',
            cwd: process.env.HOME,
            env: process.env
        });

        this.term.on('data', (data) => {
            channelService.emitTerminalData(data, false);
            this.xterm.write(data);
        });

        this.element = $('<div />', {class: 'chat-codes-terminal'});

        Terminal.loadAddon('fit');  // Load the `fit` addon
        this.xterm = new Terminal();
        this.xterm.open(this.getElement());
        this.xterm.fit();  // Make the terminal's size and geometry fit the size of #terminal-container

        this.xterm.on('data', (key) => {
            // channelService.writeToTerminal(key);
    		let at_bottom = this.atBottom();
            this.term.write(key);
            if (at_bottom) {
    			this.scrollToBottom();
            }
        });
        // channelService.on('terminal-data', (event) => {
        //     console.log(event);
        //     this.xterm.write(event.data);
        // });
        channelService.on('write-to-terminal', (event) => {
    		let at_bottom = this.atBottom();
            this.term.write(event.contents);
            if (at_bottom) {
    			this.scrollToBottom();
            }
        });
    }
    serialize() {
        return { };
    }

    // Tear down any state and detach
    destroy() {
        this.element.remove();
    }

    getElement() {
        return this.element[0];
    }
    show() {
        this.element.show();
    }
    hide() {
        this.element.hide();
    }
	atBottom() {
		return Math.abs(this.element.scrollTop() + this.element.height() - this.element.prop('scrollHeight')) < 100;
	}
	scrollToBottom() {
        this.element.scrollTop(this.element.prop('scrollHeight'));
	}
}