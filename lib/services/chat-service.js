'use babel';

const fs = require('fs');
const path = require('path');
const _ = require('underscore');
const url = require('url');
import Pusher from 'pusher-js';

app_id = "359042"
key = "44f522b8df5a8a3ccf74"
secret = "d8d561e9aafb45f2ff14"
cluster = "us2"

// Pusher.log = function(message) {
// 	if (window.console && window.console.log) {
// 		window.console.log(message);
// 	}
// };

function generateChannelName(socket) {
    const WORD_FILE_NAME = 'google-10000-english-usa-no-swears-medium.txt'

    return new Promise(function(resolve, reject) {
        fs.readFile(path.join(__dirname, WORD_FILE_NAME), {encoding: 'utf-8'}, function(err, result) {
            if(err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    }).then(function(words) {
        // return _.shuffle(words.split(/\n/));
        return ['channel'];
    }).then(function(wordList) {
        function* getNextWord() {
            for(var i = 0; i<wordList.length; i++) {
                yield wordList[i];
            }
            var j = 0;
            while(true) {
                yield j;
                j++;
            }
        }

        function getNextAvailableName(iterator) {
            if(!iterator) {
                var iterator = getNextWord();
            }
            const {value} = iterator.next();
            return channelNameAvailable(value, socket).then(function(available) {
                if(available) {
                    return value;
                } else {
                    return getNextAvailableName(iterator);
                }
            });
        }

        return getNextAvailableName();
    });
}

function channelNameAvailable(name, pusher) {
    return new Promise(function(resolve, reject) {
        var presenceChannel = pusher.subscribe('presence-'+name);
        resolve(presenceChannel.members.count === 0);
    });
}

class ChatChannel {
    constructor(pusher) {
        this.pusher = pusher;
        this.channelName = generateChannelName(this.pusher);
        this.channel = this.channelName.then(function(name) {
            console.log('created channel ' + name);
            return pusher.subscribe('private-'+name);
        }).then(function(channel) {
            channel.bind('client-message', function(data) {
                console.log(data);
            });
			channel.bind('subscription_succeeded', function(data) {
                console.log('subbed');
				console.log(data);
			});
        	window.channel = channel;
            return channel;
        }).catch(function(err) {
            console.error(err);
        });
    }

    destroy() {
        this.getName().then(_.bind(function(name) {
            this.pusher.unsubscribe(name);
        }, this));
    }

    getName() {
        return this.channelName;
    }

    getURL() {
        return this.getName().then(function(name) {
            return url.format({
                protocol: 'https',
                host: 'chat.codes',
                pathname: name
            });
        });
    }

    postTextMessage(message) {
        this.channel.then(_.bind(function(channel) {
            channel.trigger('client-message', {
                type: 'text',
                message: message
            });
            console.log(channel);
        }, this));
    }
}

export default class ChatService {
    constructor(serializedState) {
        this.pusher = new Pusher(key, {
            cluster: cluster,
    		authEndpoint: 'http://chat.codes/auth.php',
            encrypted: true
        });
        this.clients = {};
    }

    createChannel() {
        var channel = new ChatChannel(this.pusher);
        channel.getName().then(_.bind(function(name) {
            this.clients[name] = channel;
        }, this));
        return channel;
    }

    destroyChannel(name) {
        if(this.clients[name]) {
            var client = this.clients[name]
            client.destroy();
            delete this.clients[name];
        }
    }

    // Returns an object that can be retrieved when package is activated
    serialize() {}

    // Tear down any state and detach
    destroy() {
        this.pusher.disconnect();
    }
}
//
// function getAuthURL(userName) {
//     let params = new URLSearchParams();
//     params.set('name', userName); // the user's search value
// 	return 'http://chat.codes/auth.php?'+params.toString();
// }
//
// @Injectable()
// export class PusherService {
//     constructor(private userName:string, private channelName:string) {
//         this.pusher = new Pusher(CREDENTIALS.key, {
//     		cluster: CREDENTIALS.cluster,
//     		encrypted: true,
//     		authEndpoint: getAuthURL(this.userName)
//         });
//         this.channel = this.pusher.subscribe('private-'+this.channelName)
//     	this.channel.bind('client-message', (data) => {
//             this.message.emit(_.extend({
//                 sender: this.userList.getUser(data.uid)
//             }, data));
//     	});
//     	this.channel.bind('client-typing', (data) => {
//             const {uid, status} = data;
//             const user = this.userList.getUser(uid);
//
//             if(user) {
//                 user.setTypingStatus(status);
//             }
//     	});
//
//         this.presenceChannel = this.pusher.subscribe('presence-'+this.channelName);
//         this.myID = this.presenceChannel.members.myID;
//
//         this.presenceChannel.bind('pusher:subscription_succeeded', (members) => {
//             this.myID = members.myID;
//             this.userList.addAll(members);
//         });
//
//         this.presenceChannel.bind('pusher:member_added', (member) => {
//             this.userList.add(false, member.id, member.info.name);
//         });
//         this.presenceChannel.bind('pusher:member_removed', (member) => {
//             this.userList.remove(member.id);
//         });
//     }
//     public sendTextMessage(message:string):void {
//         const data = {
//             uid: this.myID,
//             type: 'text',
//             message: message,
//             timestamp: this.getTimestamp()
//         };
//
//         this.channel.trigger('client-message', data);
//         this.message.emit(_.extend({
//             sender: this.userList.getMe()
//         }, data));
//     }
//     public sendTypingStatus(status:string):void {
//         const data = {
//             uid: this.myID,
//             type: 'status',
//             status: status,
//             timestamp: this.getTimestamp()
//         };
//         const meUser = this.userList.getMe();
//
//         this.channel.trigger('client-typing', data);
//         this.typingStatus.emit(_.extend({
//             sender: this.userList.getMe()
//         }, data));
//
//         if(meUser) {
//             meUser.setTypingStatus(status);
//         }
//     }
//
//     public membersChanged: EventEmitter<any> = new EventEmitter();
//     public message: EventEmitter<any> = new EventEmitter();
//     public typingStatus: EventEmitter<any> = new EventEmitter();
//     public userList:ChatUserList = new ChatUserList();
//
//     private pusher:Pusher;
//     private myID:string;
//     private channel;
//     private presenceChannel;
//     private getTimestamp():number {
//         return new Date().getTime();
//     }
// }
