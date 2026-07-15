import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const phaseEnum = pgEnum("phase", [
  "group",
  "r32",
  "r16",
  "qf",
  "sf",
  "third",
  "final",
]);

export const winnerSideEnum = pgEnum("winner_side", ["home", "away"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  displayName: text("display_name").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  // set by an admin password reset; forces the user to /cuenta until changed
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teams = pgTable("teams", {
  id: smallint("id").primaryKey(),
  fifaCode: text("fifa_code").notNull().unique(),
  name: text("name").notNull(),
  flag: text("flag").notNull(),
  groupLetter: text("group_letter").notNull(),
  drawPosition: smallint("draw_position").notNull(),
});

export const matches = pgTable("matches", {
  id: smallint("id").primaryKey(), // official FIFA match number 1-104
  phase: phaseEnum("phase").notNull(),
  groupLetter: text("group_letter"),
  kickoffAt: timestamp("kickoff_at", { withTimezone: true }).notNull(),
  venue: text("venue").notNull(),
  homeTeamId: smallint("home_team_id").references(() => teams.id),
  awayTeamId: smallint("away_team_id").references(() => teams.id),
  homeSource: text("home_source"),
  awaySource: text("away_source"),
  // admin can re-open predictions for a match past its kickoff (late onboarding)
  openOverride: boolean("open_override").notNull().default(false),
});

export const predictions = pgTable(
  "predictions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    matchId: smallint("match_id")
      .notNull()
      .references(() => matches.id),
    homeScore: smallint("home_score").notNull(),
    awayScore: smallint("away_score").notNull(),
    // required when a knockout prediction is a draw; relative to the slot
    winnerSide: winnerSideEnum("winner_side"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.matchId] })],
);

export const results = pgTable("results", {
  matchId: smallint("match_id")
    .primaryKey()
    .references(() => matches.id),
  homeScore: smallint("home_score").notNull(), // 90 minutes
  awayScore: smallint("away_score").notNull(),
  winnerSide: winnerSideEnum("winner_side"), // penalties winner on knockout draws
  // null when inserted by the automated sync cron job
  enteredBy: uuid("entered_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// manual admin correction of the real bracket when derivation differs from FIFA
export const knockoutOverrides = pgTable("knockout_overrides", {
  matchId: smallint("match_id")
    .primaryKey()
    .references(() => matches.id),
  homeTeamId: smallint("home_team_id").references(() => teams.id),
  awayTeamId: smallint("away_team_id").references(() => teams.id),
});

// user pools: admin-created, joined via shareable invite code
export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// per-match click battle: one row per user, aggregated with SUM for the scoreboard.
// The row exists for rate limiting (lastFlushAt), not for display.
export const battleClicks = pgTable(
  "battle_clicks",
  {
    matchId: smallint("match_id")
      .notNull()
      .references(() => matches.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // integer, not smallint: a dedicated fan can exceed 32k clicks in one match
    homeClicks: integer("home_clicks").notNull().default(0),
    awayClicks: integer("away_clicks").notNull().default(0),
    lastFlushAt: timestamp("last_flush_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.matchId, table.userId] })],
);

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.userId] })],
);
