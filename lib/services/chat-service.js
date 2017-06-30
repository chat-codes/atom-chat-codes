'use babel';

const fs = require('fs');
const path = require('path');
const _ = require('underscore');
const url = require('url');

const EventEmitter = require('events');
import Pusher from 'pusher-js';

key = "44f522b8df5a8a3ccf74"
cluster = "us2"

function getAuthURL(userName) {
    return url.format({
        hostname: 'chat.codes',
        protocol: 'https',
        pathname: 'auth.php',
        query: { name: userName}
    });
}

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
        return _.shuffle(words.split(/\n/));
        // return ['channel'];
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
        presenceChannel.bind('pusher:subscription_succeeded', (members) => {
            var myID = members.myID;
            var anyOtherPeople = _.some(members.members, (memberInfo, id) => {
                return id !== myID;
            });
            resolve(!anyOtherPeople);
        });
    });
}

class ChatChannel {
    constructor(channelName, pusher) {
        this.pusher = pusher;
        this.channelName = channelName;
        this.channel = this.pusher.subscribe('private-'+this.channelName);
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
        const data = {
            uid: this.myID,
            type: 'text',
            message: message,
            timestamp: this.getTimestamp()
        };

        this.channel.trigger('client-message', data);
        this.message.emit(_.extend({
            sender: this.userList.getMe()
        }, data));

        this.channel.then(_.bind(function(channel) {
            channel.trigger('client-message', {
                type: 'text',
                message: message
            });
            console.log(channel);
        }, this));
    }
}

export default class ChatService extends EventEmitter {
    constructor(username) {
        super();
        this.pusher = new Pusher(key, {
            cluster: cluster,
    		authEndpoint: getAuthURL(username),
            encrypted: true
        });
        this.clients = {};
    }

    createChannel() {
        return generateChannelName(this.pusher).then((channelName) => {
            var channel = new ChatChannel(channelName, this.pusher);
            this.clients[channelName] = channel;
            return channel;
        });
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
