'use babel';

import CodeChatView from './view/sidebar-view';
import AtomCommunicationService from './services/atom-communication-service';
import { CompositeDisposable } from 'atom';

export default {

	codeChatView: null,
	modalPanel: null,
	subscriptions: null,

	activate(state) {
		this.codeChatView = new CodeChatView(state.codeChatViewState);
		const item = {
			element: this.codeChatView.getElement(),
			getTitle: () => 'chat.codes',
			// getURI: () => 'atom://my-package/my-item',
			getDefaultLocation: () => 'right',
			getIconName: () => 'comment-discussion'
		};
		atom.workspace.open(item);
		// channel.getURL().then(function(url) {
		// 	console.log(url);
		// });
		// // channel.postTextMessage('hello world');
		// this.codeChatView = new CodeChatView(state.codeChatViewState);
		// this.codeChatView.on('sendTextMessage', function(data) {
		// 	const {message} = data;
		// 	channel.postTextMessage(message);
		// });
		// this.chatView = atom.workspace.addBottomPanel({
		// 	item: this.codeChatView.getElement(),
		// 	visible: true
		// });
		//
		// // Register command that toggles this view
		// this.subscriptions.add(atom.commands.add('atom-workspace', {
		// 	'code-chat:toggle': () => this.toggle()
		// }));
		// Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
		this.subscriptions = new CompositeDisposable();
	},

	deactivate() {
		this.subscriptions.dispose();
		this.codeChatView.destroy();
	},

	serialize() {
		return {
			codeChatViewState: this.codeChatView.serialize()
		};
	},

	toggle() {
		console.log('CodeChat was toggled!');
		return (
			this.modalPanel.isVisible() ?
			this.modalPanel.hide() :
			this.modalPanel.show()
		);
	}

};