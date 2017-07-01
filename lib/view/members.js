'use babel';

const $ = require('jquery');
const _ = require('underscore');
const EventEmitter = require('events');

class MemberView {
	constructor(user) {
		this.element = $('<li />', {text: user.id + ' ' + user.name + ' ' + user.typingStatus});
		user.on('typingStatus', (data) => {
			this.element.text(user.id + ' ' + user.name + ' ' + user.typingStatus);
		});
	}
	destroy() {
		this.getElement().remove();
	}
	getElement() {
		return this.element;
	}
}

export default class MembersView extends EventEmitter {
	constructor(channel) {
		super();
		this.channel = channel;
		this.memberViews = {};
		this.element = $('<div />');
		this.header = $('<h2 />', {text: 'Members'});
		this.ul = $('<ul />');

		var userList = this.channel.userList;
		this.element.append(this.header, this.ul);

		_.each(userList.getUsers(), (user) => {
			this.addUser(user);
		});

		userList.on('userAdded', (data) => {
			this.addUser(data.user);
		});
		userList.on('userRemoved', (data) => {
			this.removeUser(data.id);
		});
	}
	addUser(user) {
		var memberView = new MemberView(user);
		this.memberViews[user.id] = memberView;
		this.ul.append(memberView.getElement());
	}
	removeUser(id) {
		var memberView = this.memberViews[id];
		memberView.destroy();
		delete this.memberViews[id];
	}
	destroy() {
	}
	getElement() {
		return this.element;
	}
}
