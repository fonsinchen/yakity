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
inherit Yakity.Base;
inherit Serialization.Signature : SIG;
inherit Serialization.BasicTypes;
inherit Serialization.PsycTypes;

array(object) sessions = ({});
mixed user;
function logout_cb; // logout callback
int count = 0; // this is a local counter. the js speaks a subset of 
			   // what psyc should do
object mmp_signature;

mapping(int:object) history = ([]);

void create(object server, object uniform, mixed user, function logout) {
	::create(server, uniform);
	this_program::user = user;
	logout_cb = logout;

	SIG::create(server->type_cache);

	mmps_ignature = MMPPacket(Atom());

	object m = Yakity.Message();
	m->method = "_notice_login";
	m->vars = ([ "_profile" : get_profile() ]);
	broadcast(m);
}

void implicit_logout() {
	if (logout_cb) {
		logout_cb(this);
		object m = Yakity.Message();
		m->method = "_notice_logout";
		broadcast(m);
		logout_cb = 0;
	} else {
		werror("NO logout callback given. Cleanup seems impossible.\n");
	}

}

void add_session(object session) {
	sessions += ({ session });
	session->cb = incoming;
	session->error_cb = session_error;
	object m = Yakity.Message();
	m->vars = ([
		"_last_id" : count,
	]);
	m->method = "_status_circuit";
	m->data = "Welcome on board.";
	MMP.Packet p = MMP.Packet(encode_message(m), ([ "_source" : uniform ]));
	session->send(mmp_signature->encode(p));

	if (find_call_out(implicit_logout) != -1) {
		remove_call_out(implicit_logout);
	}
}

void logout() {
	sendmsg(uniform, "_notice_logout", "You are being terminated. Server restart.", ([]), uniform);

	call_out(logout_cb, 0, this);
}

void session_error(object session, string err) {
	sessions -= ({ session });
	session->error_cb = 0;
	session->cb = 0;

	if (!sizeof(sessions)) {
		if (-1 == find_call_out(implicit_logout)) call_out(implicit_logout, 0);
	}

	werror("ERROR: %O %s\n", session, err);
}
int _request_history_delete(MMP.Packet p) {
	if (p->source() != uniform) {
		return Yakity.GOON;
	}

	Yakity.Message m = message_decode(p->data);
	array(int) list = m->vars["_messages"];

	if (!arrayp(list)) {
		error("Bad request.\n");
	}

	foreach (list;;int n) {
		if (has_index(history, n)) m_delete(history, n);
	}

	return Yakity.STOP;
}

int _request_history(MMP.Packet p) {
	if (!p->misc["session"]) {
		return Yakity.STOP;
	}

	if (p->source() != uniform) {
		return Yakity.GOON;
	}

	Yakity.Message m = message_decode(p->data);
	array(int) list = m->vars["_messages"];

	if (!arrayp(list)) {
		error("Bad request.\n");
	}

	foreach (list;;int n) {
		if (has_index(history, n)) m->misc->session->send(history[n]);
	}

	return Yakity.STOP;
}

int _request_logout(MMP.Packet p) {

	if (p->source() == uniform) {
		implicit_logout();
	}

	return Yakity.STOP;
}

int _message_private(MMP.Packet p) {
	MMP.Uniform source = p->source();

	if (source && source != uniform) {
		send(source, p->data, source);
	}

	return Yakity.GOON;
}

mapping get_profile() {
	return ([ "_name_display" : user->real_name ]);
}

int _request_profile(MMP.Packet p) {
	MMP.Uniform source = m->vars["_source"];

	if (source) {
		Yakity.Message reply = Yakity.Message();
		reply->vars = ([
			"_profile" : get_profile(),
		]);
		reply->method = "_update_profile";
		send(source, reply);
	}

	return Yakity.STOP;
}

void incoming(object session, Serialization.Atom atom) {
	MMP.Packet p = mmp_signature->encode(p);

	//werror("%s->incoming(%O, %O)\n", this, session, m);
	p->vars["_source"] = uniform;

	if (p->target() == uniform) {
		m->misc["session"] = session;
		if (Yakity.STOP == ::msg(m)) {
			return;
		}
		// sending messages to yourself.
	}

	// TODO: could be inaccurate.
	m->vars["_timestamp"] = Yakity.Date(time());
	send(m);
}

int msg(MMP.Packet p) {
	//werror("%s->msg(%O)\n", this, m);

	if (::msg(m) == Yakity.STOP) return Yakity.STOP;

	p->vars["_id"] = ++count;

	Serialization.Atom atom;
	mixed err = catch {
		atom = mmp_signature->encode(p);
	};

	// minimize it, will not be needed again anyhow
	atom->make_raw();
	atom->set_raw(atom->type, atom->data);

	history[count] = atom;

	foreach (sessions;; object s) {
		s->send(atom);
	}
}

string _sprintf(int type) {
	if (type == 'O') {
		return sprintf("User(%s, %O)", uniform, sessions);
	} else {
		return sprintf("User(%s)", uniform);
	}
}
