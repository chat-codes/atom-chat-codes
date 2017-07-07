'use babel'

const _ = require('underscore');
const EventEmitter = require('events');
import Pusher from 'pusher-js';
const key = "44f522b8df5a8a3ccf74"
const cluster = "us2"
const url = require('url');
const SIZE_THRESHOLD = 5;
const EMIT_RATE = 100;

function getAuthURL(userName) {
    return url.format({
        hostname: 'chat.codes',
        protocol: 'http',
        pathname: 'auth.php',
        query: { name: userName}
    });
}
function chunkString(str:string, maxChunkSize:number):Array<string> {
    return str.match(new RegExp('.{1,'+maxChunkSize+'}', 'g'));
}

export default class PusherCommunicationLayer extends EventEmitter {
    constructor(authInfo) {
        super()
        this.pusher = new Pusher(key, {
            cluster: cluster,
    		authEndpoint: getAuthURL(authInfo.username),
            encrypted: true
        });
        this.channels = {};
        this.messageQueue = [];
    }
    getChannelSubscriptionPromise(channelName) {
        return new Promise((resolve, reject) => {
            let channel = this.pusher.subscribe(channelName);
            if(channel.subscribed) {
                resolve(channel);
            } else {
                channel.bind('pusher:subscription_succeeded', () => {
                    resolve(channel);
                });
                channel.bind('pusher:subscription_error', (err) => {
                    reject(err);
                });
            }
        });
    }
    onMemberAdded(channelName, callback) {
        const {presencePromise} = this.getChannel(channelName);
        presencePromise.then(function(channel) {
            channel.bind('pusher:member_added', callback);
        });
    }
    onMemberRemoved(channelName, callback) {
        const {presencePromise} = this.getChannel(channelName);
        presencePromise.then(function(channel) {
            channel.bind('pusher:member_removed', callback);
        });
    }
    channelReady(channelName) {
        const {privatePromise, presencePromise} = this.getChannel(channelName);
        return Promise.all([privatePromise, presencePromise]);
    }
    trigger(channelName, eventName, eventContents) {
        const {privatePromise} = this.getChannel(channelName);
        privatePromise.then(function(channel) {
            const stringifiedContents = JSON.stringify(eventContents);
            channel.trigger('client-'+eventName, {
                payload: stringifiedContents,
                messageNum: 0,
                totalNum: 0
            });
        });
    }
    bind(channelName, eventName, callback) {
        const {privatePromise} = this.getChannel(channelName);
        privatePromise.then((channel) => {
            channel.bind('client-' + eventName, (packagedData) => {
                const {payload} = packagedData;
                const data = JSON.parse(payload);
                callback(data);
            });
        });
    }
    getMembers(channelName) {
        const {presencePromise} = this.getChannel(channelName);
        return presencePromise.then(function(channel) {
            return channel.members;
        });
    }
    channelNameAvailable(name) {
        var presenceChannel = this.pusher.subscribe('presence-'+name);
        return getChannelSubscriptionPromise('presence-'+name).then(function(channel) {
            const members = channel.members;
            var myID = members.myID;
            var anyOtherPeople = _.some(members.members, (memberInfo, id) => {
                return id !== myID;
            });
            // channel.disconnect();
            return (!anyOtherPeople);
        });
    }
    getChannel(channelName) {
        if(!this.isSubscribed(channelName)) {
            this.doSubscribe(channelName);
        }
        return this.channels[channelName];
    }
    isSubscribed(channelName) {
        return _.has(this.channels, channelName);
    }
    doSubscribe(channelName) {
        this.channels[channelName] = {
            privatePromise: this.getChannelSubscriptionPromise('private-'+channelName),
            presencePromise: this.getChannelSubscriptionPromise('presence-'+channelName)
        };
    }
    doUnsubscribe(channelName) {
        // this.channels[channelName].private.unsubscribe();
        // this.channels[channelName].presence.unsubscribe();
        this.pusher.unsubscribe('private-'+channelName);
        this.pusher.unsubscribe('presence-'+channelName);
        delete this.channels[channelName];
    }
    destroy() {
        this.pusher.disconnect();
    }
}
