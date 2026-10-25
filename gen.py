import csv, random, hashlib, datetime as dt
from faker import Faker
random.seed(42); Faker.seed(42)
fk = Faker("en_IN")
SALT = "DEMO_ONLY_SERVER_SALT"

branches = {"CSE":"BTCS","CSE-DS":"BTCSDS","IT":"BTIT","ECE":"BTEC","ME":"BTME","CE":"BTCE","EE":"BTEE"}
weights = [30,15,15,15,10,8,7]
years = [1,2,3,4]
admission_year = {1:25,2:24,3:23,4:22}

students=[]; used=set()
for i in range(1000):
    b = random.choices(list(branches), weights)[0]
    y = random.choice(years)
    while True:
        n = random.randint(1,999)
        enr = f"{admission_year[y]}100{branches[b]}{n:05d}"
        if enr not in used: used.add(enr); break
    name = fk.name()
    email = enr.lower()+"@campus.edu"
    students.append(dict(enrollment_no=enr,name=name,email=email,branch=b,year=y,
                         gender=random.choice(["M","F","O"]) if False else "",
                         role="STUDENT"))
for s in students: s.pop("gender")
# admins
admins=[dict(enrollment_no=f"ADMIN{i:03d}",name=n,email=f"admin{i}@campus.edu",branch="ADMIN",year=0,role="ADMIN")
        for i,n in enumerate(["Election Commissioner","Deputy Commissioner"],1)]
with open("students.csv","w",newline="") as f:
    w=csv.DictWriter(f,fieldnames=list(students[0])); w.writeheader(); w.writerows(admins+students)

elections=[
 dict(election_id=1,name="Student Council President 2026",scope="ALL",status="CLOSED",start_time="2026-09-10T09:00:00",end_time="2026-09-10T17:00:00"),
 dict(election_id=2,name="Cultural Committee Secretary 2026",scope="ALL",status="ACTIVE",start_time="2026-10-24T09:00:00",end_time="2026-10-26T17:00:00"),
 dict(election_id=3,name="CSE Department Representative 2026",scope="CSE",status="UPCOMING",start_time="2026-11-05T09:00:00",end_time="2026-11-05T17:00:00"),
]
with open("elections.csv","w",newline="") as f:
    w=csv.DictWriter(f,fieldnames=list(elections[0])); w.writeheader(); w.writerows(elections)

M=["Longer library hours during exams","Better Wi-Fi and charging points across campus","More funding for student clubs and hackathons","Cleaner and cheaper canteen options","Open-door monthly meetings with the administration","Placement preparation workshops every semester","Safer late-night transport for hostel students","More sports facilities and inter-college events"]
cand_n={1:5,2:4,3:3}
cands=[]; cid=0
for e in elections:
    for k in range(1,cand_n[e["election_id"]]+1):
        cid+=1
        pool=[s for s in students if e["scope"] in ("ALL",s["branch"])]
        s=random.choice(pool)
        cands.append(dict(candidate_id=k,election_id=e["election_id"],name=s["name"],
                          enrollment_no=s["enrollment_no"],branch=s["branch"],year=s["year"],
                          manifesto=random.choice(M)))
with open("candidates.csv","w",newline="") as f:
    w=csv.DictWriter(f,fieldnames=list(cands[0])); w.writeheader(); w.writerows(cands)

def nullifier(enr,eid): return "0x"+hashlib.sha256(f"{enr}{eid}{SALT}".encode()).hexdigest()
turnout={1:0.68,2:0.35,3:0.0}
elig=[]; votes=[]
for e in elections:
    eid=e["election_id"]
    cs=[c for c in cands if c["election_id"]==eid]
    # skewed popularity
    wts=[random.uniform(0.5,2.0) for _ in cs]
    start=dt.datetime.fromisoformat(e["start_time"])
    span = 8*3600 if eid==1 else 6*3600
    for s in students:
        if e["scope"] not in ("ALL",s["branch"]): continue
        voted = random.random()<turnout[eid]
        elig.append(dict(election_id=eid,enrollment_no=s["enrollment_no"],has_voted=int(voted)))
        if voted:
            c=random.choices(cs,wts)[0]
            ts=start+dt.timedelta(seconds=random.randint(0,span))
            votes.append(dict(election_id=eid,candidate_id=c["candidate_id"],
                              nullifier=nullifier(s["enrollment_no"],eid),timestamp=ts.isoformat()))
random.shuffle(votes); votes.sort(key=lambda v:(v["election_id"],v["timestamp"]))
with open("eligibility.csv","w",newline="") as f:
    w=csv.DictWriter(f,fieldnames=list(elig[0])); w.writeheader(); w.writerows(elig)
with open("simulated_votes.csv","w",newline="") as f:
    w=csv.DictWriter(f,fieldnames=list(votes[0])); w.writeheader(); w.writerows(votes)

# summary
from collections import Counter
for e in elections:
    eid=e["election_id"]; c=Counter(v["candidate_id"] for v in votes if v["election_id"]==eid)
    n=sum(1 for x in elig if x["election_id"]==eid)
    print(eid,e["name"],"eligible",n,"votes",sum(c.values()),dict(sorted(c.items())))
print(len(students),"students", len(set(v["nullifier"] for v in votes)),"unique nullifiers /",len(votes))
