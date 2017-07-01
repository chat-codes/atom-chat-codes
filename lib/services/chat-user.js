'use babel';

const _ = require('underscore');

const EventEmitter = require('events');

class ChatUser extends EventEmitter {
    constructor(isMe, id, name, active) {
        super();
        this.active = active;
        this.isMe = isMe;
        this.id = id;
        this.name = name;
        this.typingStatus = 'IDLE'
    }
    setTypingStatus(status) {
        this.typingStatus = status;
        this.emit('typingStatus', {
            status: status
        });
    }
    serialize() {
        return {
            id: this.id,
            name: this.name,
            typingStatus: this.typingStatus,
            active: this.active
        }
    }
}

export default class ChatUserList extends EventEmitter {
    constructor() {
        super()
        this.activeUsers = [];
        this.allUsers = [];
    }
    serialize() {
        return _.map(this.allUsers, (u) => { return u.serialize() } );
    }
    getUsers() {
        return this.activeUsers;
    }
    addAll(memberInfo) {
        const myID = memberInfo.myID;
        _.each(memberInfo.members, (memberInfo, id) => {
            this.add(id===myID, id, memberInfo.name);
        });
    }
    add(isMe, id, name, active=true) {
        const user = new ChatUser(isMe, id, name, active);
        this.allUsers.push(user);
        this.activeUsers.push(user);
        this.emit('userAdded', {
            user: user
        });
        return user;
    }

    remove(id:string) {
        for(var i = 0; i<this.activeUsers.length; i++) {
            var id_i = this.activeUsers[i].id;
            if(id_i === id) {
                this.activeUsers[i].active = false;
                this.activeUsers.splice(i, 1);
                this.emit('userRemoved', {
                    id: id
                });
                break;
            }
        }
    }

    getUser(id) {
        for(var i = 0; i<this.allUsers.length; i++) {
            var id_i = this.allUsers[i].id;
            if(id_i === id) {
                return this.allUsers[i];
            }
        }
        return false;
    }
    getMe() {
        for(var i = 0; i<this.allUsers.length; i++) {
            if(this.allUsers[i].isMe) {
                return this.allUsers[i];
            }
        }
        return false;
    }
}
