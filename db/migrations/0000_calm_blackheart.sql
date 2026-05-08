CREATE TYPE "public"."feed_id" AS ENUM('english', 'star-sports-hindi', 'jiohotstar-hindi-championswaali');--> statement-breakpoint
CREATE TYPE "public"."panel_source" AS ENUM('manual-upload', 'manual-url-paste');--> statement-breakpoint
CREATE TYPE "public"."panel_status" AS ENUM('confirmed', 'unverified');--> statement-breakpoint
CREATE TABLE "feed" (
	"id" "feed_id" PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"language" text NOT NULL,
	"broadcaster" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match" (
	"id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"toss_at" timestamp with time zone,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"marquee" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "panel_announcement" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"feed_id" "feed_id" NOT NULL,
	"source" "panel_source" NOT NULL,
	"source_url" text,
	"raw_blob_path" text NOT NULL,
	"parsed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confidence" double precision NOT NULL,
	"status" "panel_status" NOT NULL,
	"raw_parse_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "panel_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"panel_announcement_id" text NOT NULL,
	"position" integer NOT NULL,
	"name_as_shown" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "panel_announcement" ADD CONSTRAINT "panel_announcement_match_id_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_entry" ADD CONSTRAINT "panel_entry_panel_announcement_id_panel_announcement_id_fk" FOREIGN KEY ("panel_announcement_id") REFERENCES "public"."panel_announcement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_date_teams_uniq" ON "match" USING btree ("date","home_team","away_team");--> statement-breakpoint
CREATE UNIQUE INDEX "panel_match_feed_uniq" ON "panel_announcement" USING btree ("match_id","feed_id");