var AccChat = psyc.Chat.extend({
	constructor : function (client, templates) {
		this.base(client, templates);
		this.DOMtoWIN = new Mapping();
		this.templates = templates;
		this.active = undefined;
		var self = this;
		this.accordion = new Accordion(document.getElementById("chathaven"), 'a.toggler', 'div.chatwindow', {
			onActive: function(toggler, element){
				var chatwin = self.DOMtoWIN.get(toggler);
				if (chatwin && self.active != chatwin) {
					toggler.setStyle('color', '#41464D');
					
					self.active = chatwin;
					window.setTimeout((function(node) {
											chatwin.getMessagesNode().style.overflow="auto";
									  }), 700);
				} else if (!chatwin) {
					self.active = null;
				}

			},
			onBackground: function(toggler, element){
				toggler.setStyle('color', '#528CE0');
				var chatwin = self.DOMtoWIN.get(toggler);
				if (chatwin) chatwin.getMessagesNode().style.overflow="hidden";
			}
			//opacity : false
		});
	},
	msg : function(m) {
		var ret = this.base(m);	
		var win = this.getWindow(m.vars.get("_source"));
		win.getMessagesNode().scrollTop = win.getMessagesNode().scrollHeight;
		return ret;
	},
	removeWindow : function(uniform) {
		var win = this.getWindow(uniform);
		this.accordion.togglers.splice(win.pos, 1);
		this.accordion.elements.splice(win.pos, 1);
		document.getElementById("chathaven").removeChild(win.header);
		document.getElementById("chathaven").removeChild(win.div);
		this.DOMtoWIN.remove(win.header.firstChild);

		if (this.active == win) {
			if (win.pos < this.accordion.elements.length) {
				this.active = this.DOMtoWIN.get(this.accordion.togglers[win.pos]);
				this.accordion.display(win.pos, false);
			} else if (win.pos > 0) {
				this.active = this.DOMtoWIN.get(this.accordion.togglers[win.pos-1]);
				this.accordion.display(win.pos-1, false);
			}
		}

		var messages = win.getMessages();

		for (var i = 0; i < messages.length; i++) {
			var id = messages[i].id();

			if (id != undefined) {
				messages[i] = id;	
			} else { // we assume that this wont happen often
				messages.splice(i, 1);
				i--;
			}
		}

		var m = new psyc.Message("_request_history_delete", { _messages : messages, _target : this.client.uniform });
		this.client.send(m);

		this.base(uniform);
	},
	enterRoom : function(uniform) {
		this.base(uniform);
		this.accordion.display(this.getWindow(uniform).pos);
	},
	createWindow : function(uniform) {
		var win;
		var toggler = document.createElement("div");
		UTIL.addClass(toggler, "toggler");

		if (uniform.is_person()) {
			win = new psyc.TemplatedWindow(this.templates, uniform);
			UTIL.addClass(win.getMessagesNode(), "privatechat");
		} else {
			win = new psyc.RoomWindow(this.templates, uniform);
			win.renderMember = function(uniform) {
				return profiles.getDisplayNode(uniform);
			};
			UTIL.addClass(win.getMessagesNode(), "roomchat");
		}
		var header = document.createElement("div");
		UTIL.addClass(header, "header");
		this.DOMtoWIN.set(toggler, win);
		toggler.appendChild(profiles.getDisplayNode(uniform));
		header.appendChild(toggler);

		if (uniform != this.client.uniform) { // not the status window
			var a;
			var chat = this;

			if (uniform.is_person()) {
				a = elink("close");
				a.onclick = function() {
					chat.removeWindow(uniform);
				};
			} else {
				var b = elink("close");
				b.onclick = function() {
					var win = chat.getWindow(uniform);
					if (win.left) {
						chat.removeWindow(uniform);
					} else {
						chat.leaveRoom(uniform);
					}
				};
				header.appendChild(b);
				a = elink("leave");
				a.onclick = function() {
					chat.leaveRoom(uniform);
				};
			}
			header.appendChild(a);
		}

		var div = document.createElement("div");
		UTIL.addClass(div, "chatwindow");
		UTIL.addClass(win.getMessagesNode(), "messages");
		div.appendChild(win.getMessagesNode());

		if (uniform.is_room()) {
			div.appendChild(win.getMembersNode());
		}
		var pos = this.accordion.elements.length;
		document.getElementById("chathaven").appendChild(header);
		document.getElementById("chathaven").appendChild(div);
		this.accordion.addSection(toggler, div, pos);


		// fixes the flicker bug. dont know why mootools is fucking with the styles
		// at all.
		div.style.overflow = "auto";

		win.header = header;
		win.div = div;
		win.pos = pos;

		if (!this.active) {
			this.active = win;
			this.accordion.display(pos);
		}

		return win;
	}
});