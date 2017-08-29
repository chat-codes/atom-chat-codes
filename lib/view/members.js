'use babel';

const $ = require('jquery');
const _ = require('underscore');
const EventEmitter = require('events');

class MemberView {
	constructor(user) {
		this.user = user;
		this.element = $('<li />', { class: 'member user-'+this.user.colorIndex });
		this.userDisplay = $('<span />', { text: user.name, class: 'user' })

		if(user.getIsMe()) {
			this.element.addClass('isme');
		}

		this.element.append(this.userDisplay);

		user.on('typingStatus', (data) => {
			this.updateClasses();
		});
		this.updateClasses();
	}
	updateClasses() {
		const {typingStatus} = this.user;

		if(typingStatus === 'IDLE') {
			this.userDisplay.removeClass('typing typed');
		} else if(typingStatus === 'ACTIVE_TYPING') {
			this.userDisplay.removeClass('typed').addClass('typing');
		} else { // IDLE_TYPED
			this.userDisplay.removeClass('typing').addClass('typed');
		}
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
		this.element = $('<div />', {class: 'member-list'});
		// this.header = $('<h2 />', {text: 'Here now: '});
		this.ul = $('<ul />', {class: 'members'});

		const userList = this.channel.userList;
		this.element.append(this.ul);

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
