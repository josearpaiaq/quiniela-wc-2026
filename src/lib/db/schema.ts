import {
  boolean,
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
  enteredBy: uuid("entered_by")
    .notNull()
    .references(() => users.id),
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
