CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`submission_id` text NOT NULL,
	`question_id` integer NOT NULL,
	`nominee` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`submission_id`, `question_id`),
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
