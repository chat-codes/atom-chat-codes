'use babel';

const $ = require('jquery');
const _ = require('underscore');
const EventEmitter = require('events');

const STATUS = {
    IDLE: 'IDLE',
    ACTIVE_TYPING: 'ACTIVE_TYPING',
    IDLE_TYPED: 'IDLE_TYPED'
};
const typingTimeout = 3000;

export default class ChatWindowView extends EventEmitter {

    constructor(username) {
        super()
        this.activeTypingTimeout = -1;
        this.typingStatus = STATUS.IDLE;
        this.element = $('<div />', {class: 'chat-input'});
        this.chatInput = $('<atom-text-editor />', {
            attr: {
                'mini': 'mini'
            }
        });

        this.chatEditor = this.chatInput[0].getModel();
        this.chatEditor.setPlaceholderText('say something');
        console.log(this.chatEditor.toggleSoftWrapped());
        console.log(this.chatEditor.getSoftWrapColumn());


        this.chatInput.on('keydown', (event) => {
            if (event.keyCode === 13) {
                this.sendCurrentMessage();
                this.setTypingStatus(STATUS.IDLE);
                this.clearActiveTypingTimeout();
            }
        });

        this.chatEditor.onDidChange((event) => {
            const val = this.chatEditor.getText();
            if (val === '') {
                this.setTypingStatus(STATUS.IDLE);
                this.clearActiveTypingTimeout();
            } else {
                this.setTypingStatus(STATUS.ACTIVE_TYPING);
                this.resetActiveTypingTimeout();
            }
        });

        var updateCISelectionFlag;
        var chatInputSelectionRange;
        var chatInputSelectionType;
        var linkStartIndex;
        var linkEndIndex;

        this.chatEditor.onDidChangeSelectionRange((event) => {
            this.chatInputSelectionRange = {
              start : event.newScreenRange.start.column,
              end : event.newScreenRange.end.column
            }
            //console.log(this.chatInputSelectionRange);
        });


        const editor = atom.workspace.getActiveTextEditor();

        atom.workspace.onDidChangeActiveTextEditor((event) =>{
          //console.log(event);
          event.onDidChangeSelectionRange((event) => {
            //this.updateCISelectionFlag = false;
            var startRow = event.newScreenRange.start.row;
            var startCol = event.newScreenRange.start.column;
            var endRow = event.newScreenRange.end.row;
            var endCol = event.newScreenRange.end.column;
            var message = this.chatEditor.getText();

            this.checkChatInputSelectionType();
            //console.log(this.chatInputSelectionType);

            if(startRow==endRow && startCol==endCol){
              if(this.chatInputSelectionType=="A WRITTEN LINK"){
                var messageTemp = message.substring(this.chatInputSelectionRange.start, this.chatInputSelectionRange.end+1);
                messageTemp = messageTemp.substring(1, messageTemp.indexOf("]("));
                if(messageTemp == "This is a link!"){
                  this.chatEditor.insertText('',{select:true});
                  //console.log(this.chatInputSelectionRange);
                }else{
                  this.chatEditor.insertText(messageTemp,{select:true});
                }
              }
            }else{
              if(this.chatInputSelectionType=="A CHOSEN MESSAGE"){
                var messageTemp = message.substring(this.chatInputSelectionRange.start, this.chatInputSelectionRange.end);
                messageTemp = "["+messageTemp+"]("+this.getOpenFileTitle()+":L"+startRow+","+startCol+"-L"+endRow+","+endCol+")";
                this.chatEditor.insertText(messageTemp,{select:true});
              }
              else if(this.chatInputSelectionType=="A WRITTEN LINK"){
                var messageTemp = message.substring(this.chatInputSelectionRange.start, this.chatInputSelectionRange.end);
                messageTemp = messageTemp.substring(1, messageTemp.indexOf("]("));
                messageTemp = "["+messageTemp+"]("+this.getOpenFileTitle()+":L"+startRow+","+startCol+"-L"+endRow+","+endCol+")";
                this.chatEditor.insertText(messageTemp,{select:true});
              }
              else if(this.chatInputSelectionType=="EMPTY"){
                var messageTemp = "["+"This is a link!"+"]("+this.getOpenFileTitle()+":L"+startRow+","+startCol+"-L"+endRow+","+endCol+")";
                this.chatEditor.insertText(messageTemp,{select:true});
              }
              else if(this.chatInputSelectionType=="EMPTY CHOSEN MESSAGE"){
                var messageTemp = message.substring(this.chatInputSelectionRange.start, this.chatInputSelectionRange.end);
                messageTemp = "["+"This is a link!"+"]("+this.getOpenFileTitle()+":L"+startRow+","+startCol+"-L"+endRow+","+endCol+")";
                this.chatEditor.insertText(messageTemp,{select:true});
              }
              //console.log(this.chatEditor.getText());
            }
          });
        });

        editor.onDidChangeSelectionRange((event) => {
          //this.updateCISelectionFlag = false;
          var startRow = event.newScreenRange.start.row;
          var startCol = event.newScreenRange.start.column;
          var endRow = event.newScreenRange.end.row;
          var endCol = event.newScreenRange.end.column;
          var message = this.chatEditor.getText();

          this.checkChatInputSelectionType();
          //console.log(this.chatInputSelectionType);

          if(startRow==endRow && startCol==endCol){
            if(this.chatInputSelectionType=="A WRITTEN LINK"){
              var messageTemp = message.substring(this.chatInputSelectionRange.start, this.chatInputSelectionRange.end+1);
              messageTemp = messageTemp.substring(1, messageTemp.indexOf("]("));
              if(messageTemp == "This is a link!"){
                this.chatEditor.insertText('',{select:true});
                //console.log(this.chatInputSelectionRange);
              }else{
                this.chatEditor.insertText(messageTemp,{select:true});
              }
            }
          }else{
            if(this.chatInputSelectionType=="A CHOSEN MESSAGE"){
              var messageTemp = message.substring(this.chatInputSelectionRange.start, this.chatInputSelectionRange.end);
              messageTemp = "["+messageTemp+"]("+this.getOpenFileTitle()+":L"+startRow+","+startCol+"-L"+endRow+","+endCol+")";
              this.chatEditor.insertText(messageTemp,{select:true});
            }
            else if(this.chatInputSelectionType=="A WRITTEN LINK"){
              var messageTemp = message.substring(this.chatInputSelectionRange.start, this.chatInputSelectionRange.end);
              messageTemp = messageTemp.substring(1, messageTemp.indexOf("]("));
              messageTemp = "["+messageTemp+"]("+this.getOpenFileTitle()+":L"+startRow+","+startCol+"-L"+endRow+","+endCol+")";
              this.chatEditor.insertText(messageTemp,{select:true});
            }
            else if(this.chatInputSelectionType=="EMPTY"){
              var messageTemp = "["+"This is a link!"+"]("+this.getOpenFileTitle()+":L"+startRow+","+startCol+"-L"+endRow+","+endCol+")";
              this.chatEditor.insertText(messageTemp,{select:true});
            }
            else if(this.chatInputSelectionType=="EMPTY CHOSEN MESSAGE"){
              var messageTemp = message.substring(this.chatInputSelectionRange.start, this.chatInputSelectionRange.end);
              messageTemp = "["+"This is a link!"+"]("+this.getOpenFileTitle()+":L"+startRow+","+startCol+"-L"+endRow+","+endCol+")";
              this.chatEditor.insertText(messageTemp,{select:true});
            }
            //console.log(this.chatEditor.getText());
          }
        });



        this.element.append(this.chatInput);
    }

    setChatInputSelectionRange(start, end){
      this.chatEditor.setSelectedScreenRange([[0,start],[0,end]]);
    }


    checkChatInputSelectionType(){
      var message = this.chatEditor.getText();
      //console.log(message);

      if(message==''){
        this.chatInputSelectionType = "EMPTY";
      }else{
        if(this.chatInputSelectionRange.start != undefined){
          //console.log(this.chatInputSelectionRange.start);
          //console.log(this.chatInputSelectionRange.end);
          //Condition messageEditorSelection start != end
          if(this.chatInputSelectionRange.start!=this.chatInputSelectionRange.end){
            var messageLeftPart = message.substring(0, this.chatInputSelectionRange.start+1);
            var messageRightPart = message.substring(this.chatInputSelectionRange.end-1);
            this.linkStartIndex = messageLeftPart.lastIndexOf('[');
            this.linkEndIndex = messageRightPart.indexOf(')')==-1? -1: messageRightPart.indexOf(')')+this.chatInputSelectionRange.end;
            if(this.linkStartIndex != -1 && this.linkEndIndex != -1){
                var messageTemp = message.substring(this.linkStartIndex+1, this.linkEndIndex);
                if(messageTemp.indexOf("](") != -1 && messageTemp.indexOf("[")==-1){
                  this.chatInputSelectionRange.start = this.linkStartIndex;
                  this.chatInputSelectionRange.end = this.linkEndIndex;
                  this.setChatInputSelectionRange(this.chatInputSelectionRange.start, this.chatInputSelectionRange.end)
                  this.chatInputSelectionType = "A WRITTEN LINK";
                }
                else{
                  this.chatInputSelectionType = "A CHOSEN MESSAGE";
                }
            }else{
              this.chatInputSelectionType = "A CHOSEN MESSAGE";
            }
          }
          //Condition messageEditorSelection start == end
          else{
            if(this.chatInputSelectionRange.end == 0){
              this.chatInputSelectionType = "EMPTY CHOSEN MESSAGE";
            }else{
              this.chatInputSelectionType = "NO OPERATION";
            }
          }
        }
        else{
          this.chatInputSelectionType = "UNDEFINED NO OPERATION";
        }
        //if it include anything like [ or ] or ( or ) It is not a legal chosen message
        if(this.chatInputSelectionType == "A CHOSEN MESSAGE"){
          var messageTemp = this.chatEditor.getSelectedText();
          if(messageTemp.indexOf('[')!=-1 || messageTemp.indexOf(']')!=-1 ||
          messageTemp.indexOf('(')!=-1 || messageTemp.indexOf(')')!=-1 ){
            this.chatInputSelectionType = "NOT A LEGAL CHOSEN MESSAGE";
          }
        }
      }
    }

    getOpenFileTitle(){
      return atom.workspace.getActiveTextEditor().getTitle();
    }

    sendCurrentMessage() {
        const toSend = this.chatEditor.getText();
        if (toSend.length > 0) {
            this.chatEditor.setText('');
            this.emit('sendTextMessage', {
                message: toSend
            });
        }
    }

    setTypingStatus(newStatus) {
        if (this.typingStatus != newStatus) {
            this.typingStatus = newStatus;
            this.emit('setTypingStatus', {
                status: this.typingStatus
            });
        }
        return this.typingStatus;
    };

    // Tear down any state and detach
    destroy() {
        this.element.remove();
    }

    getElement() {
        return this.element;
    }
    setActiveTypingTimeout() {
        this.activeTypingTimeout = window.setTimeout(() => {
            this.setTypingStatus(STATUS.IDLE_TYPED);
        }, typingTimeout);
    }
    clearActiveTypingTimeout() {
        if (this.hasActiveTypingTimeout()) {
            window.clearTimeout(this.activeTypingTimeout);
            this.activeTypingTimeout = -1;
        }
    }
    hasActiveTypingTimeout() {
        return this.activeTypingTimeout >= 0;
    }
    resetActiveTypingTimeout() {
        this.clearActiveTypingTimeout();
        this.setActiveTypingTimeout();
    }
}
