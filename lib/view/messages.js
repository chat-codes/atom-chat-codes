'use babel';

const moment = require('moment');
const EventEmitter = require('events');
const $ = require('jquery');
const _ = require('underscore');
import { EditGroup, MessageGroup } from 'chat-codes-services/built/chat-messages';

class MessageView {
	constructor(data, editorStateTracker) {
		this.editorStateTracker = editorStateTracker;
		this.element = $('<li />', {html: data.getHTML(), class: 'message'});

		$('a.line_ref', this.element).on('mouseenter', (me_event) => {
			const {file, range} = this.getHighlightInfo(me_event.currentTarget);
			const highlightID = this.addHighlight(file, range);
			$(me_event.target).on('mouseleave.removeHighlight', (ml_event) => {
				this.removeHighlight(file, highlightID);
				$(me_event.target).off('mouseleave.removeHighlight');
			});
        }).on('click', (c_event) => {
			const {file, range} = this.getHighlightInfo(c_event.currentTarget);
			this.focusRange(file, range);
		});
	}
	getHighlightInfo(elem) {
		const $elem = $(elem);
		const start = $elem.attr('data-start');
		const end = $elem.attr('data-end');

		return {
			file: $elem.attr('data-file'),
			range: {
				start: _.map(start.split(','), x => parseInt(x)),
				end: _.map(end.split(','), x => parseInt(x))
			}
		};
	}
	destroy() {}
	addHighlight(editorID, range) {
		return this.editorStateTracker.addHighlight(editorID, range);
	}
	removeHighlight(editorID, highlightID) {
		return this.editorStateTracker.removeHighlight(editorID, highlightID);
	}
	focusRange(editorID, range) {
		return this.editorStateTracker.focus(editorID, range);
	}
}

class MessageGroupView {
	constructor(messageGroup, editorStateTracker, parentView) {
		this.parentView = parentView;
		this.editorStateTracker = editorStateTracker;
		this.sender = messageGroup.getSender();
		this.timestamp = messageGroup.getTimestamp();
		this.momentTimestamp = moment(this.timestamp);

		this.element = $('<li />', {class: 'message-group user-'+this.sender.getColorIndex()});
		this.headerView = $('<div />', {class: 'message-group-header user-'+this.sender.getColorIndex()});
		this.messagesView = $('<ul />', {class: 'message-list'});

		this.senderView = $('<span />', {text: this.sender.getName(), class: 'sender'});
		this.timestampView = $('<span />', {class: 'timestamp'});

		this.headerView.append(this.senderView, this.timestampView);
		this.element.append(this.headerView, this.messagesView);
		this.messages = [];

		this.timestampUpdateInterval = setInterval(() => {
			this.updateTimestamp();
		}, 10000);
		this.updateTimestamp();

		messageGroup.on('message-added', (e) => {
			const {message, insertionIndex} = e;
			this.addMessage(message, insertionIndex);
		});
		_.each(messageGroup.getMessages(), (m, index) => {
			this.addMessage(m, index);
		});
	}
	updateTimestamp() {
		this.timestampView.text(this.momentTimestamp.fromNow());
	}
	addMessage(data, index) {
		let at_bottom = this.parentView.atBottom();
		const mv = new MessageView(data, this.editorStateTracker);
		this.messages.push(mv);
		$(mv.element).insertAt(index, this.messagesView);
		if(at_bottom) {
			this.parentView.scrollToBottom();
		}
	}
	destroy() {
		clearInterval(this.timestampUpdateInterval);
		_.each(this.messages, (m) => {
			m.destroy();
		});
	}
}

function commafy(elements) {
	if(elements.length === 1) {
		return [elements];
	} else if(elements.length === 2) {
		return [
			elements[0],
			$('<span />', { text: ' and '}),
			elements[1]
		];
	} else if(elements.length > 2) {
		const rv = [];
		_.each(elements, (e, i) => {
			rv.push(e);
			if(i === elements.length-2) {
				rv.push($('<span />', { text: ', and '}));
			} else {
				rv.push($('<span />', { text: ', '}));
			}
		});
		return rv;
	} else {
		return [];
	}
}

class EditGroupView {
	constructor(messageGroup, editorStateTracker, parentView) {
		this.element = $('<li />', {class: 'edit'});
		this.messageGroup = messageGroup;
		this.timestamp = messageGroup.getTimestamp();
		this.momentTimestamp = moment(this.timestamp);

		this.timestampView = $('<span />', {class: 'timestamp'});
		messageGroup.on('delta-added', (e) => {
			this.updateInfo();
		});

		this.editors = $('<span />', {class:'editors'});
		this.files = $('<span />', {class:'files'});

		this.timestampUpdateInterval = setInterval(() => {
			this.updateTimestamp();
		}, 10000);
		this.updateTimestamp();

		this.element.append(this.editors, ' edited ', this.files, ' ', this.timestampView);

		this.updateInfo();
	}
	destroy() {
	}
	updateInfo() {
		const authors = this.messageGroup.getAuthors();
		const files = this.messageGroup.getEditorStates();

		const authorElements = _.map(authors, (a) => ( $('<span />', { class: 'user-'+a.getColorIndex(), text: a.getName() }) ))
		const fileElements = _.map(files, (f) => ( $('<a />', {
			attr: {
				'href': 'javascript:void(0)'
			},
			text: f.getTitle()
		}) ) );

		this.editors.children().remove();
		this.editors.append.apply(this.editors, commafy(authorElements));

		this.files.children().remove();
		this.files.append.apply(this.files, commafy(fileElements));
	}
	updateTimestamp() {
		this.timestampView.text(this.momentTimestamp.fromNow());
	}
}

export default class MessagesView extends EventEmitter {
	constructor(channel) {
		super();

		this.typingMessages = {};
		this.messageGroups = channel.messageGroups;
		this.editorStateTracker = channel.editorStateTracker;

		this.messageGroupingTimeThreshold = 5*60*1000; // 5 minutes

		this.element = $('<div />', {class: 'messages'});
		this.ul = $('<ul />', {class: 'message-group-list'});
		this.emptyIndicator = $('<div />', {class: 'empty-messages', text: '(no messages)'})
		this.typingIndicator = $('<div />', {class: 'typing-indicator'});

		this.messageGroups.on('group-added', (e) => {
			const {messageGroup, insertionIndex} = e;
			this.addToMessageGroups(messageGroup, insertionIndex);
			this.emptyIndicator.remove();
		})

        channel.on('typing', (event) => {
            const {status, sender, uid} = event;

			if(!sender.getIsMe()) {
				let at_bottom = this.atBottom();
	            if(!this.typingMessages[uid]) {
	                this.typingMessages[uid] = $('<div />', {class: 'typing-status', text: sender.getName()});
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
	addToMessageGroups(messageGroup, index) {
		let at_bottom = this.atBottom();
		let groupView;
		if(messageGroup instanceof MessageGroup) {
			groupView = new MessageGroupView(messageGroup, this.editorStateTracker, this);
		} else {
			groupView = new EditGroupView(messageGroup, this.editorStateTracker, this);
		}

		$(groupView.element).insertAt(index, this.ul);

        if (at_bottom) {
			this.scrollToBottom();
		}
		if(messageGroup instanceof MessageGroup) {
			const sidebar = this.element.parents('.chat-codes-sidebar');
			if(!sidebar.is(':visible') || this.element.parents('.atom-dock-open').length === 0 && !messageGroup.getSender().getIsMe()) {
				atom.notifications.addInfo(messageGroup.getSender().getName() + ': ' + messageGroup.getMessages()[0].getMessage());
			}
		}
		//
		// $(window).on('pane:became-inactive', (event) => {
		// 	console.log(event);
		// });
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

//https://stackoverflow.com/questions/391314/jquery-insertat
$.fn.insertAt = function(index, $parent) {
    return this.each(function() {
        if (index === 0) {
            $parent.prepend(this);
        } else {
            $parent.children().eq(index - 1).after(this);
        }
    });
};