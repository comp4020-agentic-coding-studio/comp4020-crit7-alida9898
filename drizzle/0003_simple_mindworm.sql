CREATE TABLE `class_prefs` (
	`plan_id` text NOT NULL,
	`course_id` text NOT NULL,
	`activity` text NOT NULL,
	`occurrence` text NOT NULL,
	`mode` text NOT NULL,
	PRIMARY KEY(`plan_id`, `course_id`, `activity`, `occurrence`),
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE cascade
);
