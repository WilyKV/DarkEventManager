CREATE TABLE "app_config" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_config_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"is_online_mode" boolean DEFAULT true NOT NULL,
	"master_device_id" text,
	"master_device_name" text,
	"last_sync_at" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer,
	"username" text,
	"action" text NOT NULL,
	"table_name" text NOT NULL,
	"record_id" integer,
	"record_data" text,
	"changes" text,
	"ip_address" text,
	"user_agent" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discounts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "discounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"zombie_discount" integer DEFAULT 0,
	"survivant_discount" integer DEFAULT 0,
	"staff_discount" integer DEFAULT 0,
	"squad_id" integer,
	"squad_discount" integer,
	"participant_id" integer,
	"participant_discount" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "discounts_participant_id_unique" UNIQUE("participant_id")
);
--> statement-breakpoint
CREATE TABLE "meal_discounts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meal_discounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"zombie_discount" integer DEFAULT 0,
	"survivant_discount" integer DEFAULT 0,
	"staff_discount" integer DEFAULT 0,
	"squad_id" integer,
	"squad_discount" integer,
	"participant_id" integer,
	"participant_discount" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "meal_discounts_participant_id_unique" UNIQUE("participant_id")
);
--> statement-breakpoint
CREATE TABLE "meal_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meal_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"icon" text,
	"stock" integer DEFAULT 0 NOT NULL,
	"price" text NOT NULL,
	"category" text
);
--> statement-breakpoint
CREATE TABLE "meal_purchases" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meal_purchases_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"participant_id" integer NOT NULL,
	"meal_item_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" text NOT NULL,
	"original_price" text NOT NULL,
	"discount_applied" integer DEFAULT 0,
	"total_price" text NOT NULL,
	"is_paid" boolean DEFAULT false,
	"purchased_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "participants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"type" text NOT NULL,
	"time_slot_id" integer,
	"squad_id" integer,
	"arrived" boolean DEFAULT false,
	"arrived_at" timestamp,
	"returned" boolean DEFAULT false,
	"returned_at" timestamp,
	"secret_code" text,
	"meal_ticket_given" boolean DEFAULT false,
	"water_bottle_given" boolean DEFAULT false,
	"squad_explained" boolean DEFAULT false,
	"briefing_explained" boolean DEFAULT false,
	"makeup_wait_explained" boolean DEFAULT false,
	"map_given" boolean DEFAULT false,
	"checklist_completed" boolean DEFAULT false,
	"has_free_meal" boolean DEFAULT false,
	"free_meal_claimed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchases_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"participant_id" integer NOT NULL,
	"shop_item_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" text NOT NULL,
	"original_price" text NOT NULL,
	"discount_applied" integer DEFAULT 0,
	"total_price" text NOT NULL,
	"is_paid" boolean DEFAULT false,
	"purchased_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shop_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "shop_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"icon" text,
	"stock" integer DEFAULT 0 NOT NULL,
	"price" text NOT NULL,
	"category" text
);
--> statement-breakpoint
CREATE TABLE "squad_audit_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "squad_audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"participant_id" integer NOT NULL,
	"previous_squad_id" integer,
	"new_squad_id" integer,
	"changed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "squads" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "squads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"number" integer NOT NULL,
	"type" text NOT NULL,
	"time_slot_id" integer NOT NULL,
	"max_members" integer DEFAULT 8,
	"briefing" text
);
--> statement-breakpoint
CREATE TABLE "time_slots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "time_slots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"type" text NOT NULL,
	"meal_time" text NOT NULL,
	"briefing_time" text NOT NULL,
	"game_time" text NOT NULL,
	"exit_time" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"roles" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"last_login_at" timestamp,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "beacon_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"participant_id" integer NOT NULL,
	"beacon_id" integer NOT NULL,
	"session_id" text,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"assigned_by" integer,
	"returned_at" timestamp,
	"returned_by" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "beacons" (
	"id" serial PRIMARY KEY NOT NULL,
	"hardware_id" text NOT NULL,
	"uuid" text,
	"major" integer,
	"minor" integer,
	"name" text,
	"status" text DEFAULT 'available' NOT NULL,
	"battery_level" integer,
	"last_seen_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "beacons_hardware_id_unique" UNIQUE("hardware_id")
);
--> statement-breakpoint
CREATE TABLE "ble_sync_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"scanner_id" integer,
	"session_type" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"hits_received" integer DEFAULT 0,
	"hits_validated" integer DEFAULT 0,
	"hits_rejected" integer DEFAULT 0,
	"errors" jsonb,
	"synced_by" integer,
	"device_info" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"name" text,
	"type" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"duration" integer,
	"total_survivants" integer DEFAULT 0,
	"total_zombies" integer DEFAULT 0,
	"beacons_assigned" integer DEFAULT 0,
	"scanners_assigned" integer DEFAULT 0,
	"total_hits" integer DEFAULT 0,
	"validated_hits" integer DEFAULT 0,
	"rejected_hits" integer DEFAULT 0,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"config" jsonb,
	"stats" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "hits" (
	"id" serial PRIMARY KEY NOT NULL,
	"beacon_id" integer NOT NULL,
	"scanner_id" integer NOT NULL,
	"survivor_id" integer,
	"zombie_id" integer,
	"session_id" text,
	"hit_timestamp" timestamp NOT NULL,
	"rssi" integer NOT NULL,
	"proximity_duration" integer,
	"synced_at" timestamp DEFAULT now(),
	"sync_session_id" integer,
	"validated" boolean DEFAULT true,
	"validation_score" integer,
	"validation_flags" jsonb,
	"raw_data" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scanner_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"participant_id" integer NOT NULL,
	"scanner_id" integer NOT NULL,
	"squad_id" integer,
	"session_id" text,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"assigned_by" integer,
	"returned_at" timestamp,
	"returned_by" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scanners" (
	"id" serial PRIMARY KEY NOT NULL,
	"hardware_id" text NOT NULL,
	"mac_address" text,
	"name" text,
	"status" text DEFAULT 'available' NOT NULL,
	"battery_level" integer,
	"firmware_version" text,
	"last_sync_at" timestamp,
	"hit_count" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scanners_hardware_id_unique" UNIQUE("hardware_id")
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text,
	"coordinates" jsonb,
	"capacity" integer,
	"status" text DEFAULT 'active',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_squad_id_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_discounts" ADD CONSTRAINT "meal_discounts_squad_id_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_discounts" ADD CONSTRAINT "meal_discounts_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_purchases" ADD CONSTRAINT "meal_purchases_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_purchases" ADD CONSTRAINT "meal_purchases_meal_item_id_meal_items_id_fk" FOREIGN KEY ("meal_item_id") REFERENCES "public"."meal_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_time_slot_id_time_slots_id_fk" FOREIGN KEY ("time_slot_id") REFERENCES "public"."time_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_squad_id_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_shop_item_id_shop_items_id_fk" FOREIGN KEY ("shop_item_id") REFERENCES "public"."shop_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "squad_audit_log" ADD CONSTRAINT "squad_audit_log_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "squad_audit_log" ADD CONSTRAINT "squad_audit_log_previous_squad_id_squads_id_fk" FOREIGN KEY ("previous_squad_id") REFERENCES "public"."squads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "squad_audit_log" ADD CONSTRAINT "squad_audit_log_new_squad_id_squads_id_fk" FOREIGN KEY ("new_squad_id") REFERENCES "public"."squads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "squads" ADD CONSTRAINT "squads_time_slot_id_time_slots_id_fk" FOREIGN KEY ("time_slot_id") REFERENCES "public"."time_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beacon_assignments" ADD CONSTRAINT "beacon_assignments_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beacon_assignments" ADD CONSTRAINT "beacon_assignments_beacon_id_beacons_id_fk" FOREIGN KEY ("beacon_id") REFERENCES "public"."beacons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ble_sync_sessions" ADD CONSTRAINT "ble_sync_sessions_scanner_id_scanners_id_fk" FOREIGN KEY ("scanner_id") REFERENCES "public"."scanners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hits" ADD CONSTRAINT "hits_beacon_id_beacons_id_fk" FOREIGN KEY ("beacon_id") REFERENCES "public"."beacons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hits" ADD CONSTRAINT "hits_scanner_id_scanners_id_fk" FOREIGN KEY ("scanner_id") REFERENCES "public"."scanners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hits" ADD CONSTRAINT "hits_survivor_id_participants_id_fk" FOREIGN KEY ("survivor_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hits" ADD CONSTRAINT "hits_zombie_id_participants_id_fk" FOREIGN KEY ("zombie_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scanner_assignments" ADD CONSTRAINT "scanner_assignments_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scanner_assignments" ADD CONSTRAINT "scanner_assignments_scanner_id_scanners_id_fk" FOREIGN KEY ("scanner_id") REFERENCES "public"."scanners"("id") ON DELETE cascade ON UPDATE no action;