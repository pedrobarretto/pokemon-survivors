-- Amigos no Realm (src/realm.ts, ../src/realm/friends.ts): "Mostrar onde estou para amigos", on by default. Off, mutual friends
-- see the player in the Poké Realm but not in which city or room (`hidden`). Only adds, so the previous API keeps working during a rollout.
alter table users add column realm_show_where boolean not null default true;
