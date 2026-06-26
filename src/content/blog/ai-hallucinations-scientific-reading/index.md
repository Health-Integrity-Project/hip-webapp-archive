---
title: "Hallucinations in literature review can be invisible"
description: "How we cut near-total hallucination in our paper-review agent down to almost none — the grounding setup that keeps an LLM honest when reading scientific PDFs."
date: 2026-06-26
author: "Lorena Pantano"
draft: false
---

As a scientist, you read studies all the time. Some in your field, because you want to build on them, and some outside it, because you want to learn before making a decision.

LLMs have made it much easier to read at scale. But that comes with a big risk: getting completely wrong information that we don't double-check, because it all makes sense. We think, how is it possible you'd give me a wrong number from the paper, when I handed you the PDF to pull the information from?

The reality is it happens all the time. And if you don't build safeguards, it shows up right away, in every message, to some degree.

A note on scope: this is about building your own review agent on the [Claude API](https://platform.claude.com/docs/en/api/overview), where you control the PDF, the prompt, and the cache. If you only use a chat app, you have fewer of these levers, but the failure modes are the same.

At the [Health Integrity Project](https://healthintegrityproject.org), where accuracy is non-negotiable, we felt the consequences hard. We built an agent that runs our paper-review workflow, and it started returning wrong p-values and wrong table references, section after section. Around 95% of the numbers I spot-checked were wrong. We got pretty scared.

We want to share what we learned, and how we now mitigate almost all hallucinations in our reviewer agent.

Here is what we implemented:

1. PDF uploaded once with the [Files API](https://platform.claude.com/docs/en/build-with-claude/files) and attached to the session, reused across turns: the model always has the real paper in front of it, so it can't claim no access and fall back on memory.
2. [Prompt cache](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) on from the first message, so the full paper stays available cheaply: it's cheap to keep the paper present every turn, so we're never tempted to drop it to save cost. Cache lasts one hour.
3. A review skill with mandatory wording that forbids citing anything not in the paper: turns "be careful" into a hard rule the model checks against before writing a number.
4. The skill is re-sent on every new user message: the rules never decay out of context as the conversation grows.
5. Claude's [citations](https://platform.claude.com/docs/en/build-with-claude/citations) enabled: every quote is page-anchored to the source, not reconstructed; if it can't point to a page, it can't cite.
6. A reminder injected into each message: re-asserts "re-read before answering" exactly when the user asks about a figure, table, or number, the main hallucination trigger.

One thing to be clear about: the cache makes re-reading the paper cheap, but it's not what keeps the answers honest. Grounding does that, the PDF physically present every turn and citations forcing each quote back to a page. The cache just removes the cost excuse for skipping it.

This reduced the wrong information a lot. The scientific numbers (p-values, effect sizes, sample sizes) are now right when I check. What still slips through is a wrong reference, like pointing to the wrong table number, not a fabricated statistic. And sometimes a number looks off but comes straight from the paper, like the authors making a wrong subtraction when calculating risk between groups.

But that's not all. This also needs to be responsive, fast enough to interact with, and cost-effective, under $1 per review.

Things we tried that did not work:

1. Reviewing sections in separate turns. This increased false information. Better to get the full review back at once, then ask follow-up questions.
2. Sending the paper on every message. Very slow, since it had to be re-tokenized each time, and costly.
3. Soft language in the skill. Our skill is a 300 lines document, and half of it is making sure the AI stays neutral, scientific, and knows how to say "I don't know."

Example of a section written to avoid hallucination:

> **STRICT RULE — applies to every sentence in this section:**
> Every number, p-value, sample size, effect size, percentage, or statistical result you write MUST be a string you can locate by searching the PDF text. Before writing any number, ask yourself: "Can I find this exact string in the document right now?" If no, write "not reported." This rule applies to inline prose, blockquotes, and paraphrases equally — there is no exception for "summarizing."

And the rule that lets it stop instead of guess:

> If you re-read and still cannot locate or confirm the answer, say so plainly: "I can't confirm that from the PDF" or "not reported." A correct "I don't know" is always better than a confident wrong answer. Never produce a specific value.

We are still learning, and we get better every time. Whether you're reviewing one paper or pulling an overall picture from many, we encourage the community to keep being scientists: check what the AI tells you against the source paper itself, every time it gives you a number or a citation.
