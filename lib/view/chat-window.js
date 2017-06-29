'use babel';

const $ = require('jquery');

export default class CodeChatView {

    constructor(serializedState) {
    }

    // Returns an object that can be retrieved when package is activated
    serialize() {}

    // Tear down any state and detach
    destroy() {
        this.element.remove();
    }

    getElement() {
        return this.element;
    }

}
