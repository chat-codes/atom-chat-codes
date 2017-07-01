'use babel';

const _ = require('underscore');

const EventEmitter = require('events');

class ChatUser extends EventEmitter {
    constructor(isMe, id, name) {
        super();
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
}

export default class ChatUserList extends EventEmitter {
    constructor() {
        super()
        this.users = [];
    }
    getUsers() {
        return this.users;
    }
    addAll(memberInfo) {
        const myID = memberInfo.myID;
        _.each(memberInfo.members, (memberInfo, id) => {
            this.add(id===myID, id, memberInfo.name);
        });
    }
    add(isMe, id, name) {
        const user = new ChatUser(isMe, id, name);
        this.users.push(user);
        this.emit('userAdded', {
            user: user
        });
        return user;
    }

    remove(id:string) {
        for(var i = 0; i<this.users.length; i++) {
            var id_i = this.users[i].id;
            if(id_i === id) {
                this.users.splice(i, 1);
                this.emit('userRemoved', {
                    id: id
                });
                break;
            }
        }
    }

    hasMember(id):boolean {
        return _.any(this.users, function(u) {
            return u.id === id;
        })
    }
    getUser(id) {
        for(var i = 0; i<this.users.length; i++) {
            var id_i = this.users[i].id;
            if(id_i === id) {
                return this.users[i];
            }
        }
        return false;
    }
    getMe() {
        for(var i = 0; i<this.users.length; i++) {
            if(this.users[i].isMe) {
                return this.users[i];
            }
        }
        return false;
    }
}
