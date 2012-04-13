/*
Copyright (C) 2008-2009  Arne Goedeke
Copyright (C) 2008-2009  Matt Hardy

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
version 2 as published by the Free Software Foundation.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
*/

function elink(name,fun,title) {
	var a = document.createElement("a");
	a.href = "javascript:void(null)";
	a.appendChild((typeof(name) == "string") ? document.createTextNode(name) : name);
	if (fun) a.onclick = fun;
	if (title) a.title = title;
	return a;
}
var AccChat = Yakity.Chat.extend({
	constructor : function (client, templates, target_id, input) {
		this.target_id = target_id;
		this.input = input;
		this.base(client, templates);
		this.DOMtoWIN = new Mapping();
		this.templates = templates;
		var self = this;
		this.active = null;
		this.createAccordion = function() {
			$('#' + this.target_id).accordion({
				active: self.active ? self.active.pos : 0,
				change: self.change,
				header: 'div.header'
			});
		}
		
		this.change = function(event, ui) {
			$(ui.oldHeader).removeClass('active');
			$(ui.newHeader).addClass('active');
			self.active = self.DOMtoWIN.get(ui.newHeader[0]);
			if (self.active) {
				self.active.trigger("focus", self.active);
				//chatwin.getMessagesNode().style.overflow="auto";
			}
			/*var chatwin = self.DOMtoWIN.get(ui.oldHeader);
			if (chatwin) {
				chatwin.trigger("blur", chatwin);
				chatwin.getMessagesNode().style.overflow="hidden";
			}*/
		};
		this.createAccordion();
	},
	removeWindow : function(uniform) {
		var win = this.getWindow(uniform);
		
		var chatPanel = $('#' + this.target_id); 
		chatPanel.accordion('destroy');
		this.DOMtoWIN.remove(win.header);
		$(win.header).remove();
		$(win.container).remove();
		this.createAccordion();

		this.base(uniform);
	},
	msg : function(p, m) {
		if (!p.V("_context") || this.windows.hasIndex(p.source())) {
			var win = this.getWindow(p.source());
			if (win == null) {
				/* Chat didn't want to open the window. */
				return psyc.STOP;
			} else {
				var messages = win.getMessagesNode();
				var scrolldown = (messages.scrollTop == (messages.scrollHeight - messages.offsetHeight));
				var ret = this.base(p, m);	
				if (scrolldown) messages.scrollTop = messages.scrollHeight - messages.offsetHeight;
				return ret;
			}
		}
	},
	enterRoom : function(uniform, history) {
		var win = this.getWindow(uniform);
		$('#' + this.target_id).accordion('activate', win.pos);
		if (!win.left) return;
		this.base(uniform, history);
	},
	createWindow : function(uniform) {
		var win;
		var toggler = document.createElement("a");
		toggler.title = "toggle pane";
		UTIL.addClass(toggler, "toggler");
		
		var container = document.createElement("div");
		var header = document.createElement("div");
		var infoicon = document.createElement("div");
		UTIL.addClass(infoicon, "infoIcon");
		header.appendChild(infoicon);


		if (uniform == this.client.uniform || uniform == this.client.user) {
			win = new Yakity.TemplatedWindow(this.client, this.templates, uniform);
			toggler.appendChild(document.createTextNode("Welcome to YakityChat"));
			UTIL.addClass(header, "status");
			UTIL.addClass(container, "status");
		} else if (uniform.is_person()) {
			win = new Yakity.TemplatedWindow(this.client, this.templates, uniform);
			UTIL.addClass(win.getMessagesNode(), "privatechat");
			UTIL.addClass(header, "private");
			UTIL.addClass(container, "private");
			toggler.appendChild(profiles.getDisplayNode(uniform));
		} else {
			win = new Yakity.RoomWindow(this.client, this.templates, uniform);
			UTIL.addClass(header, "public");
			UTIL.addClass(container, "public");
			win.registerEvent("onenter", UTIL.make_method(this, function() {
				UTIL.replaceClass(container, "left", "joined");
				UTIL.replaceClass(header, "left", "joined");
			}));
			win.registerEvent("onleave", UTIL.make_method(this, function() {
				UTIL.replaceClass(container, "joined", "left");
				UTIL.replaceClass(header, "joined", "left");
			}));
			
			var members = document.createElement("div");
			UTIL.addClass(members, "membersList");
			var membersc = document.createElement("div");
			UTIL.addClass(membersc, "membersContainer");
			var togglemembers = document.createElement("a");
			UTIL.addClass(togglemembers, "focus");
			UTIL.addClass(togglemembers, "membersToggler");
			togglemembers.title = "Toggle members list";
			togglemembers.appendChild(document.createElement("div"));
			UTIL.addClass(togglemembers.firstChild, "Button");

			members.appendChild(win.getMembersNode());
			membersc.appendChild(togglemembers);
			membersc.appendChild(members);
			win.getMessagesNode().appendChild(membersc);
			togglemembers.href = "javascript:void(null)";
			togglemembers.onclick = function() {
				if (members.style.display=="none") {
					members.style.display="block";	
					UTIL.replaceClass(togglemembers, "blur", "focus");
				} else {
					members.style.display="none";	
					UTIL.replaceClass(togglemembers, "focus", "blur");
				}
			};
			
			UTIL.addClass(win.getMessagesNode(), "roomchat");
			toggler.appendChild(profiles.getDisplayNode(uniform));
		}
		win.registerEvent("new_message", UTIL.make_method(this, function(win, p, node) {
			if (this.active != win) {
				UTIL.addClass(header, "unread");
				UTIL.addClass(container, "unread");
			}
		}));
		win.registerEvent("focus", UTIL.make_method(this, function(win) {
			UTIL.removeClass(header, "unread");
			UTIL.removeClass(container, "unread");
		}));

		UTIL.addClass(header, "idle");
		UTIL.addClass(container, "idle");
		UTIL.addClass(header, "header");
		this.DOMtoWIN.set(header, win);

		if (uniform != this.client.uniform && uniform != this.client.user) { // not the status window
			var a;
			var chat = this;

			if (uniform.is_person()) {
				a = document.createElement("div");
				UTIL.addClass(a, "closeButton");
				// We need some dictionary here.
				a = elink(a, function() {
					chat.removeWindow(uniform);
				}, "close window");
				
				header.appendChild(a);
			} else {
				a = document.createElement("div");
				UTIL.addClass(a, "leaveButton");
				var b = document.createElement("div");
				UTIL.addClass(b, "closeButton");
				var c = document.createElement("div");
				UTIL.addClass(c, "enterButton");
				
				b = elink(b, function() {
					chat.removeWindow(uniform);
				}, "close window");
				a = elink(a, function() {
					chat.leaveRoom(uniform);
				}, "leave room");
				c = elink(c, function() {
					chat.enterRoom(uniform);
				}, "enter room");
				
				header.appendChild(b);
				header.appendChild(a);
				header.appendChild(c);
			}
		}

		header.appendChild(toggler);
		UTIL.addClass(container, "chatwindow");
		UTIL.addClass(win.getMessagesNode(), "messages");
		container.appendChild(win.getMessagesNode());

		var pos = $('#' + this.target_id).children().length / 2;

		document.getElementById(this.target_id).appendChild(header);
		document.getElementById(this.target_id).appendChild(container);

		$('#' + this.target_id).accordion('destroy');
		this.createAccordion();

		win.header = header;
		win.container = container;
		win.pos = pos;
		return win;
	}
});
