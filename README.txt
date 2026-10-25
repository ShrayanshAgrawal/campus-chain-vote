CampusChainVote - Synthetic Dataset (all data is fake; generated with Faker + seed 42)

students.csv        1000 students + 2 admins (enrollment_no, name, email, branch, year, role)
elections.csv       3 elections: CLOSED (campus-wide), ACTIVE (campus-wide), UPCOMING (CSE only)
candidates.csv      12 candidates (candidate_id is per election: 1..N)
eligibility.csv     who may vote in each election + has_voted flag (CSE-only election has CSE students only)
simulated_votes.csv anonymous votes: election_id, candidate_id, nullifier, timestamp
                    nullifier = sha256(enrollment_no + election_id + SERVER_SALT), SERVER_SALT = DEMO_ONLY_SERVER_SALT
                    Use only to test dashboards/audit. In the real app, votes are created by the API and go on-chain.

Turnout: election 1 ~68%, election 2 ~35%, election 3 = 0 (not started).
Rules this data respects: one nullifier per student per election; no names on votes.
