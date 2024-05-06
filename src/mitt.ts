import mitt, { Emitter, EventType, Handler } from "mitt";

export function bind<
  Events extends Record<EventType, unknown>,
  Key extends keyof Events
>(emitter: Emitter<Events>, event: Key, listener: Handler<Events[Key]>) {
  emitter.on(event, listener);
  return () => emitter.off(event, listener);
}

export function bindAll<
  Events extends Record<EventType, unknown>,
  Key extends keyof Events
>(emitter: Emitter<Events>, listeners: { [K in Key]: Handler<Events[K]> }) {
  for (const [event, listener] of Object.entries(listeners)) {
    emitter.on(event as Key, listener as Handler<Events[Key]>);
  }
  return () => {
    for (const [event, listener] of Object.entries(listeners)) {
      emitter.off(event as Key, listener as Handler<Events[Key]>);
    }
  };
}

export { mitt, Emitter, EventType, Handler };
