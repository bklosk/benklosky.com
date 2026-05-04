---
title: Big orgs can make great products
date: 2026-05-04
slug: big-orgs
visible: true
---
In 1968, with more than 105,000 employees, Boeing produced the 747, the greatest airliner of all time. Boeing was eyeing supersonic travel, developing a competitor to the Concorde, and the 747 was a lower priority project. Joseph Sutter, the engineering chief responsible for the 747, was working with 4,500 engineers against a 29 month deadline. Pressed for time, Sutter made "heretical" decisions about the fuselage, making it wider than any other aircraft, and rejecting the dominant double-decker approach of the time. 

Sutter had enough political capital to defend the double-wide fuselage, and other radical design choices, against skeptical Boeing and Pan Am executives. Leaders at Boeing placed an absurd amount of trust in Sutter and his engineers, and bet on him. Hard. Boeing borrowed an eye-watering sum of money to finance the development. The 747 made it to market, late and over budget, [cut the consumer cost of flying in half](https://ig.space/commslink/boeings-747-how-the-queen-of-the-skies-changed-the), and became the most iconic airliner ever created.


---


It's conventional wisdom that big organizations make subpar products. My boss literally [wrote the book](https://www.amazon.com/Deadly-Memos-Conventional-Companies-Pamphlet-ebook/dp/B09G5XX8MW) on this problem! Christensen declared this decades ago! But size is only correlated with shitty products-- size tempts failure, but doesn't demand it. There are *really damn good* products that are designed and made by big bureaucracies. None are explained by a founder-dictator or a skunkworks group or the other usual explanations.

- Nintendo, a Japanese company founded in 1889, with 7,000 employees, produced *Breath of the Wild*, widely known as one of the greatest video games of all time. They sold more than 35 million copies, making more than $1.5B. From one game.
- Pixar, between 1995-2015, won eighteen academy awards, ten golden globes, and eleven grammies. They won Best Animated Feature 11 times.
- Anthropic has a headcount of at least 2,500. Anthropic is likely the [fastest growing company of all time](https://www.axios.com/2026/04/13/anthropic-revenue-growth-ai), beating wartime manufacturing, railroads, and oil. They released Claude Code in May 2025, and it made $2.5B of revenue within a year.
- Lego is a $9B company that makes the most loved products in the world.

How is that at similar sizes, Lego makes delightful, beloved products, while Atlassian has a [community built around shared hatred](https://ifuckinghatejira.com) of their flagship SKU? How does Boeing produce the "queen of the skies" when they had more employees than there are people in Burlington, and then later go on to produce the disastrous 737 MAX? 

It's simple: Fujibayashi played *Breath of the Wild* obsessively during development, and got to cut what he didn't like. Boeing's chief engineers flew their own test planes. Lego sets get [playtested by Danish schoolchildren](https://www.lego.com/en-us/service/help-topics/article/lego-toy-testing) and the designers go back to the drawing board when the product doesn't work. The Claude Code team uses Claude Code to build Claude Code. 

The CEO responsible for Chili's turnaround remarks that their fries were under-seasoned, and realized only while working in the kitchen that after only five shakes of the heavy seasoning, the chef's arm gets tired. Compare that to the [infamous video](https://www.nytimes.com/2026/03/05/business/mcdonalds-ceo-big-arch-burger-video.html) of the McDonalds CEO struggling to choke down a big mac. Which firm do you think is making better products?

#### **Organizations destroy their ability to make great products by demanding legibility.**

Almost all organizations, at scale, are *deeply* uncomfortable with signals that can't be quantified. Rather than accepting that some signals aren't legible, they pretend illegible signals don't exist. This is why I *hate* using dashboards to manage products. Dashboards pretend product decisions are a function of legible signals. But you can't A/B test your way to the 747 or the iPhone. You can't get great product decisions out of a KPI. The worst case outcome is a manager instituting change management and OKRs to reduce variance in product quality, and in doing so, amputating the organizations ability to make amazing things. To make something great, you need to be able to make decisions that are not legible to the CFO.

Scale makes proxy metrics tempting because real feedback becomes expensive and noisy when you have an audience. When you have 10,000 users, it is costly in money and time to use your product or for your engineers to go talk with real users, and you instead melt all of the invaluable user experience into a meaningless Net Promoter Score. **There is no aggregation without information loss**, and the larger your organization grows, the more clamor you will hear for KPIs, dashboards, gas gauges, and other malignant proxies for excellence. Worse, you will start to make key decisions using these proxies and hoping excellence comes as a result. **There is no proxy metric for excellence.** 

In the failure mode of Atlassian, Workday, or Salesforce, you don't have a protected tastemaker who is saying "no," making an opinionated product, and alienating some users. You wind up implementing all user requests. Users have *no idea* what makes a good product-- go read any video game forum for proof-- and nobody is differentiating between what should and should not be built. You make meaningless products like [Rovo](https://www.atlassian.com/software/rovo-dev) or AgentForce that mimick what successful teams are doing, but without understanding why they're doing it. 

You're measuring WAU and pirate metrics! You have project managers! You're tracking velocity and counting features shipped! But it is causing you more harm than good. You've proved goodhart's law, and shipped features that never should have existed. You create an infinitely flexible product that does everything and nothing and is mildly frustrating for everyone and loved by no one.

Even if you do have a tastemaker, it won't work without contact with the real world and real feedback. You will fail if the engineers don't get real feedback. Development is a contact sport, and this is a real affront to some managers convinced they had a great idea-- and worse, their employees forced to build it. There's a real failure mode: a Business Analyst™️ drafts a spec for an imaginary customer, and the devs spend months working on the spec in isolation. This is what "agile" is meant to solve, but most "agile" teams never actually get user feedback. Instead, you work on a pre-specced project, with tickets written two weeks at a time, you call the waterfall design an "epic," the SVP is happy with the burndown rate, and you release a product ahead of time and under budget, to raucous applause from leadership, that no one uses.


--- 


When McDonnell-Douglas merged with Boeing in 1997, engineers got eaten by finance. McDonnell-Douglas leadership took over from the previous generation of leaders, and demanded decisions increasingly had to be defended by the "bottom line," and not on design merits or engineering prowess. The finance minded leaders at McDonnell-Douglas were proud of their new, "[more cut-throat culture, devoted to keeping costs down and favoring upgrading older models at the expense of wholesale innovation](https://qz.com/1776080/how-the-mcdonnell-douglas-boeing-merger-led-to-the-737-max-crisis)."

The time came for a new generation of the 737, a beloved plane, and McDonnell-Douglas made a decision on cost grounds to retrofit the 737 rather than develop a new plane outright.  They called it the 737 MAX. Boeing developed [strange hacks and workarounds](https://spectrum.ieee.org/how-the-boeing-737-max-disaster-looks-to-a-software-developer) to force the retrofit to work with new engines. They used software to solve hardware problems, and built a program called MCAS designed to work around the retrofit's limitations and force the new engines to work with the old fuselage.

On two 737 MAX flights, with passengers onboard, faults in MCAS caused catastrophic failures. Both flights crashed, and more than 346 people died. The FAA later found in a private report that MCAS could cause as many as 15 crashes in the next 30 years. The 737 MAX was grounded for two years. Boeing lost their authority to certify aircraft, lost more than $20 billion in direct costs, and lost an estimated $60 billion in canceled orders. Boeing happily traded away long term product leadership for short term optimization, and never recovered.