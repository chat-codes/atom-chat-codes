'use babel';

const moment = require('moment');
console.log(moment);
const EventEmitter = require('events');
const $ = require('jquery');
const _ = require('underscore');

class MessageView {
	constructor(data) {
		this.element = $('<li />', {text: data.message, class: 'message'});
	}
	destroy() {}
}

class MessageGroupView {
	constructor(data) {
		this.sender = data.sender;
		this.timestamp = data.timestamp;
		this.momentTimestamp = moment(this.timestamp);

		this.element = $('<li />', {class: 'message-group'});
		this.headerView = $('<div />', {class: 'message-group-header'});
		this.messagesView = $('<ul />', {class: 'message-list'});

		this.senderView = $('<span />', {text: data.sender.name, class: 'sender'});
		this.timestampView = $('<span />', {class: 'timestamp'});

		this.headerView.append(this.senderView, this.timestampView);
		this.element.append(this.headerView, this.messagesView);
		this.messages = [];

		this.timestampUpdateInterval = setInterval(() => {
			this.updateTimestamp();
		}, 10000);
		this.updateTimestamp();
	}
	updateTimestamp() {
		this.timestampView.text(this.momentTimestamp.fromNow());
	}
	addMessage(data) {
		const mv = new MessageView(data);
		this.messages.push(mv);
		this.messagesView.append(mv.element);
	}
	destroy() {
		clearInterval(this.timestampUpdateInterval);
		_.each(this.messages, (m) => {
			m.destroy();
		});
	}
}

export default class MessagesView extends EventEmitter {
	constructor(channel) {
		super();
		this.messageGroups = [];
		this.messageGroupingTimeThreshold = 5*60*1000; // 5 minutes

		this.element = $('<div />', {class: 'messages'});
		this.ul = $('<ul />', {class: 'message-group-list'});

		channel.on('message', (event) => {
			this.addToMessageGroups(event);
		});

		this.element.append(this.ul);
	}
	addToMessageGroups(data) {
		const {timestamp,mesage} = data;
	    let lastMessageGroup = _.last(this.messageGroups);
	    let groupToAddTo = lastMessageGroup;
	    if(!lastMessageGroup || (lastMessageGroup.timestamp < data.timestamp - this.messageGroupingTimeThreshold) || (lastMessageGroup.sender.id !== data.sender.id )) {
			groupToAddTo = new MessageGroupView({
		        sender: data.sender,
		        timestamp: data.timestamp,
			});
			this.messageGroups.push(groupToAddTo);
			this.ul.append(groupToAddTo.element);
	    }
		groupToAddTo.addMessage(data);
	}
	destroy() {
		_.each(this.messageGroups, (mg) => {
			mg.destroy();
		});
	}
	getElement() {
		return this.element;
	}
}
