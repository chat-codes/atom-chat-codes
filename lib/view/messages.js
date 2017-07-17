'use babel';

const moment = require('moment');
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

		this.element = $('<li />', {class: 'message-group user-'+this.sender.colorIndex});
		this.headerView = $('<div />', {class: 'message-group-header user-'+this.sender.colorIndex});
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

		this.typingMessages = {};
		this.messageGroups = [];
		this.messageGroupingTimeThreshold = 5*60*1000; // 5 minutes

		this.element = $('<div />', {class: 'messages'});
		this.ul = $('<ul />', {class: 'message-group-list'});
		this.emptyIndicator = $('<div />', {class: 'empty-messages', text: '(no messages)'})
		this.typingIndicator = $('<div />', {class: 'typing-indicator'});

		channel.on('message', (event) => {
			this.emptyIndicator.remove();
			this.addToMessageGroups(event);
		});

        channel.on('typing', (event) => {
			let at_bottom = this.atBottom();
            const {status, user, uid} = event;

            if(!this.typingMessages[uid]) {
                this.typingMessages[uid] = $('<div />', {class: 'typing-status', text: user.name});
				this.typingIndicator.append(this.typingMessages[uid]);
            }

            if(status === 'IDLE_TYPED') {
                this.typingMessages[uid].addClass('typed').removeClass('idle typing');
            } else if(status === 'ACTIVE_TYPING') {
                this.typingMessages[uid].addClass('typing').removeClass('idle typed');
            } else { // idle
                this.typingMessages[uid].addClass('idle').removeClass('typing typed');
            }
			if(at_bottom) {
				this.scrollToBottom();
			}
        });

		this.element.append(this.emptyIndicator, this.ul, this.typingIndicator);
	}
	atBottom() {
		return Math.abs(this.element.scrollTop() + this.element.height() - this.element.prop('scrollHeight')) < 100;
	}
	scrollToBottom() {
        this.element.scrollTop(this.element.prop('scrollHeight'));
	}
	addToMessageGroups(data) {
		let at_bottom = this.atBottom();

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

        if (at_bottom) {
			this.scrollToBottom();

			const sidebar = this.element.parents('.chat-codes-sidebar');
			if(!sidebar.is(':visible') || this.element.parents('.atom-dock-open').length === 0) {
				atom.notifications.addInfo(data.sender.name + ': ' + data.message);
			}
        } else {
			if(!data.sender.isMe) {
				atom.notifications.addInfo(data.sender.name + ': ' + data.message);
			}
		}

		$(window).on('pane:became-inactive', (event) => {
			console.log(event);
		});
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
