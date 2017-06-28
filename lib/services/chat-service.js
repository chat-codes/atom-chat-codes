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
        resolve(true); // TODO: remove
        // var presenceChannel = pusher.subscribe('presence-'+name);
        // resolve(presenceChannel.members.count === 0);
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
            console.log(this.pusher);
            channel.trigger('client-message', {
                type: 'text',
                message: message
            });
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
