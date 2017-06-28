'use babel';

const $ = require('jquery');

export default class SidebarView {

    constructor(serializedState) {
        this.element = $('<div />', {text: 'code chat'});
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