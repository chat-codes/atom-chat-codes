'use babel';

const EventEmitter = require('events');
const $ = require('jquery');

export default class MessagesView extends EventEmitter {
	constructor(channel) {
		super();
		this.channel = channel;
		this.users = [];
		this.element = $('<div />');
		this.header = $('<h2 />', {text: 'Messages'});
		this.ul = $('<ul />');

		this.channel.on('message', (event) => {
			const {timestamp, message} = event;
			$('<li />', {text: event.sender.name + ' ' + timestamp + ' ' + message}).appendTo(this.ul);
		});

		this.element.append(this.header, this.ul);
	}
	destroy() {
	}
	getElement() {
		return this.element;
	}
}
