CREATE DATABASE IF NOT EXISTS zkDevDB;
USE zkDevDB;
CREATE TABLE IF NOT EXISTS users(
	ID int NOT NULL, 
	username varchar(255) NOT NULL, 
	address int NOT NULL, 
	PRIMARY KEY (ID)
); 
CREATE TABLE IF NOT EXISTS repos(
	ID int NOT NULL, 
	views int, 
	stars int, 
	forks int, 
	PRIMARY KEY (ID)
);
CREATE TABLE IF NOT EXISTS repo_users(
	repoID int NOT NULL, 
	userID int NOT NULL, 
	commits int, 
	FOREIGN KEY (repoID) REFERENCES users(ID), 
	FOREIGN KEY (userID) REFERENCES repos(ID)
);
CREATE TABLE IF NOT EXISTS leaderboard(
	ID int NOT NULL, 
	score int NOT NULL, 
	PRIMARY KEY (ID), 
	FOREIGN KEY (ID) REFERENCES users(ID)
);


going to /dashboard -> api call to github to get data, then show it

db: 
logging in -> api call -> feed to DB
going to dashboard -> DB query to get data -> show it
