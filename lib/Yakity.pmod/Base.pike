object server;
object uniform;

void create(object server, object uniform) {
	this_program::server = server;
	this_program::uniform = uniform;
}

void send(Yakity.Message m) {
	if (!m->source()) {
		m->vars["_source"] = uniform;
	}

	server->deliver(m);
}

void broadcast(Yakity.Message m) {
	server->broadcast(m);
}

void sendmsg(MMP.Uniform target, string method, string data, mapping vars, void|MMP.Uniform source) {
	Yakity.Message m = Yakity.Message();
	m->method = method;
	m->data = data;
	m->vars = vars || ([]);
	m->vars["_target"] = target;
	if (source) m->vars["_source"] = source;
	send(m);
}

int msg(Yakity.Message m) {
	string method = m->method;

	if (method[0] = '_') {
		array(string) t = method/"_";

		for (int i = sizeof(t)-1; i >=0 ; i--) {
			mixed f = this[(t[0..i]*"_")];

			if (functionp(f)) {
				if (f(m) == Yakity.STOP) {
					return Yakity.STOP;
				}
			}
		}
	}

	return Yakity.GOON;
}

object Uniform() {
	return Serialization.Types.Uniform(server);
}