/**
 * Demo content for the seed script and the onboarding sample class.
 *
 * Everything here was written by us. Prompts are original practice prompts,
 * not College Board text. Source documents are public-domain primary sources
 * (published before 1929), excerpted. Essays are invented and belong to no
 * real student. Scores and feedback follow .claude/skills/student-feedback-writing.
 *
 * Editorial note on sources: two excerpts originally contain an em dash
 * (Finney, Mann). Our product copy rules ban em dashes, so those are rendered
 * as commas. Ellipses mark omitted text.
 */

export type DemoSource = {
  number: number;
  citation: string;
  text: string;
};

export type DemoAssignment = {
  essayType: "APUSH_DBQ" | "LANG_ARG";
  title: string;
  promptText: string;
  sources: DemoSource[];
};

export type DemoRowScore = {
  points: number;
  /** 0 to 1. Below 0.6 marks the row for teacher review. */
  confidence: number;
  /** Teacher-facing, at most 2 sentences. */
  justification: string;
  /** Student-facing: verdict, quoted evidence, one next step. At most 3 sentences. */
  studentFeedback: string;
  /** Each quote appears verbatim in the essay text. */
  quotes: string[];
};

export type DemoEssay = {
  key: string;
  studentFirstName: string;
  studentLastName: string;
  text: string;
  /** Keyed by rubric row key. */
  scores: Record<string, DemoRowScore>;
};

export type DemoStudentName = { firstName: string; lastName: string };

/* ------------------------------------------------------------------ */
/* APUSH DBQ                                                           */
/* ------------------------------------------------------------------ */

export const DEMO_DBQ: DemoAssignment = {
  essayType: "APUSH_DBQ",
  title: "Reform movements, 1820 to 1860",
  promptText:
    "Evaluate the extent to which reform movements in the United States sought to expand democratic ideals in the period from 1820 to 1860.",
  sources: [
    {
      number: 1,
      citation: "Charles Grandison Finney, Lectures on Revivals of Religion, 1835",
      text:
        "Religion is the work of man. It is something for man to do. It consists in obeying God. ... A revival is not a miracle, nor dependent on a miracle, in any sense. It is a purely philosophical result of the right use of the constituted means, as much so as any other effect produced by the application of means.",
    },
    {
      number: 2,
      citation: "William Lloyd Garrison, \"To the Public,\" The Liberator, first issue, January 1, 1831",
      text:
        "I shall strenuously contend for the immediate enfranchisement of our slave population. In Park-street Church, on the Fourth of July, 1829, in an address on slavery, I unreflectingly assented to the popular but pernicious doctrine of gradual abolition. ... I am aware that many object to the severity of my language; but is there not cause for severity? I will be as harsh as truth, and as uncompromising as justice. On this subject, I do not wish to think, or speak, or write, with moderation.",
    },
    {
      number: 3,
      citation: "Dorothea Dix, Memorial to the Legislature of Massachusetts, 1843",
      text:
        "I come to present the strong claims of suffering humanity. I come to place before the Legislature of Massachusetts the condition of the miserable, the desolate, the outcast. I come as the advocate of helpless, forgotten, insane, and idiotic men and women; of beings sunk to a condition from which the most unconcerned would start with real horror; of beings wretched in our prisons, and more wretched in our almshouses.",
    },
    {
      number: 4,
      citation:
        "Horace Mann, Twelfth Annual Report of the Secretary of the Board of Education of Massachusetts, 1848",
      text:
        "Education, then, beyond all other devices of human origin, is the great equalizer of the conditions of men, the balance-wheel of the social machinery. I do not here mean that it so elevates the moral nature as to make men disdain and abhor the oppression of their fellow-men. This idea pertains to another of its attributes. But I mean that it gives each man the independence and the means by which he can resist the selfishness of other men.",
    },
    {
      number: 5,
      citation: "Declaration of Sentiments, Seneca Falls Convention, Seneca Falls, New York, 1848",
      text:
        "We hold these truths to be self-evident: that all men and women are created equal; that they are endowed by their Creator with certain inalienable rights; that among these are life, liberty, and the pursuit of happiness. ... The history of mankind is a history of repeated injuries and usurpations on the part of man toward woman, having in direct object the establishment of an absolute tyranny over her. ... He has never permitted her to exercise her inalienable right to the elective franchise. He has compelled her to submit to laws, in the formation of which she had no voice.",
    },
    {
      number: 6,
      citation: "Henry David Thoreau, \"Resistance to Civil Government,\" 1849",
      text:
        "Unjust laws exist: shall we be content to obey them, or shall we endeavor to amend them, and obey them until we have succeeded, or shall we transgress them at once? Men generally, under such a government as this, think that they ought to wait until they have persuaded the majority to alter them. ... Under a government which imprisons any unjustly, the true place for a just man is also a prison.",
    },
    {
      number: 7,
      citation:
        "Frederick Douglass, \"What to the Slave Is the Fourth of July?\" speech delivered in Rochester, New York, July 5, 1852",
      text:
        "What, to the American slave, is your 4th of July? I answer: a day that reveals to him, more than all other days in the year, the gross injustice and cruelty to which he is the constant victim. To him, your celebration is a sham; your boasted liberty, an unholy license; your national greatness, swelling vanity; your sounds of rejoicing are empty and heartless; your denunciations of tyrants, brass fronted impudence; your shouts of liberty and equality, hollow mockery.",
    },
  ],
};

export const DEMO_DBQ_ESSAYS: DemoEssay[] = [
  {
    key: "dbq-01",
    studentFirstName: "Maya",
    studentLastName: "Okafor",
    text: `In the decades before the Civil War, the United States was changing fast. The Second Great Awakening spread the idea that people could perfect themselves and their society, while the market revolution brought factories, canals and growing cities with new problems like poverty and crime. At the same time, Jacksonian democracy had expanded voting rights for white men, which made the gap between American ideals and American reality harder to ignore.

Between 1820 and 1860, reform movements largely sought to expand democratic ideals by applying the promise of equality to groups that had been left out, especially enslaved people and women, though some reformers focused more on moral improvement and social order than on democracy itself.

Abolitionists made the strongest demand for equality. Garrison promised to fight for the "immediate enfranchisement of our slave population" and refused to speak with moderation (Doc 2). Because Garrison was writing in the first issue of his own newspaper, his purpose was to announce that the Liberator would not compromise, which explains his harsh tone. Frederick Douglass made a similar argument when he called American liberty a "sham" for enslaved people (Doc 7). As a formerly enslaved man speaking at a Fourth of July event, Douglass used the holiday to show his white audience how hollow their celebration of freedom was. The Underground Railroad, led by people like Harriet Tubman, also put these ideas into action by helping enslaved people escape north.

Women reformers used the same democratic language. The Declaration of Sentiments copied the Declaration of Independence but stated that "all men and women are created equal" (Doc 5). Its list of grievances, such as being denied "the elective franchise," shows that these reformers wanted women to take part in democracy directly.

Other reforms were less about voting and more about improving people. Horace Mann argued that education was "the great equalizer of the conditions of men" (Doc 4), and Dorothea Dix asked the Massachusetts legislature to help the insane, who were kept in prisons and almshouses (Doc 3). These reforms did expand opportunity, but they were also about creating order and good citizens in a changing society. Finney's belief that "religion is the work of man" (Doc 1) explains why so many reformers thought people could fix these problems through their own effort.

In conclusion, reform movements from 1820 to 1860 mostly tried to make democratic ideals real for more Americans. Abolitionists and women's rights activists pushed the hardest, while education and asylum reform aimed at improving society as a whole.`,
    scores: {
      thesis: {
        points: 1,
        confidence: 0.92,
        justification:
          "The second paragraph makes a defensible claim with two categories: equality for excluded groups and moral improvement.",
        studentFeedback:
          'Thesis: earned. You argued that reformers sought "to expand democratic ideals by applying the promise of equality to groups that had been left out" and named those groups. Next time, put your second category, moral improvement, into the first half of the claim so both parts carry equal weight.',
        quotes: ["to expand democratic ideals by applying the promise of equality to groups that had been left out"],
      },
      contextualization: {
        points: 1,
        confidence: 0.88,
        justification:
          "The opening describes the Second Great Awakening, the market revolution and expanded white male suffrage, and connects them to reform.",
        studentFeedback:
          'Contextualization: earned. Your opening explains how "The Second Great Awakening spread the idea that people could perfect themselves and their society" before reform began. Next time, end that paragraph with one sentence that connects this context directly to your claim.',
        quotes: ["The Second Great Awakening spread the idea that people could perfect themselves and their society"],
      },
      document_evidence: {
        points: 2,
        confidence: 0.9,
        justification:
          "Uses Documents 1, 2, 3, 4, 5 and 7 to support claims in both categories of the argument.",
        studentFeedback:
          'Evidence from the documents: earned 2 of 2 points. You used six documents to support your claims, for example "all men and women are created equal" from Document 5. Next time, explain what each quote shows in your own words before you move to the next document.',
        quotes: ["immediate enfranchisement of our slave population", "all men and women are created equal"],
      },
      outside_evidence: {
        points: 1,
        confidence: 0.85,
        justification:
          "The Underground Railroad and Harriet Tubman are specific outside evidence tied to the abolition argument.",
        studentFeedback:
          'Evidence beyond the documents: earned. You brought in "The Underground Railroad, led by people like Harriet Tubman" and tied it to the abolitionist argument. Next time, add one more detail, like the Fugitive Slave Act of 1850, to make the evidence more specific.',
        quotes: ["The Underground Railroad, led by people like Harriet Tubman"],
      },
      sourcing: {
        points: 1,
        confidence: 0.86,
        justification:
          "Explains Garrison's purpose (Document 2) and Douglass's audience and situation (Document 7) and links both to the argument.",
        studentFeedback:
          'Sourcing: earned. You explained purpose for Document 2 and audience for Document 7, where "Douglass used the holiday to show his white audience" how hollow their celebration was. Next time, add a sentence on how that context makes the document stronger evidence for your claim.',
        quotes: [
          "Because Garrison was writing in the first issue of his own newspaper, his purpose was to announce that the Liberator would not compromise",
          "Douglass used the holiday to show his white audience",
        ],
      },
      complexity: {
        points: 0,
        confidence: 0.7,
        justification:
          "The essay qualifies its claim with the moral improvement category, but that nuance stays in one paragraph and is not developed across the argument.",
        studentFeedback:
          'Complexity: not earned. You started a strong idea when you wrote that reforms "were also about creating order and good citizens in a changing society" but it stays in one paragraph. Next time, return to that tension in each body paragraph, for example by asking whether abolitionists also wanted moral order.',
        quotes: ["were also about creating order and good citizens in a changing society"],
      },
    },
  },
  {
    key: "dbq-02",
    studentFirstName: "Daniel",
    studentLastName: "Reyes",
    text: `During the early 1800s America went through a lot of changes. More white men could vote after states dropped property requirements, and Andrew Jackson was elected as a champion of the common man. Religious revivals during the Second Great Awakening told people they could choose to be saved and make the world better. These changes encouraged Americans to start reform movements.

Reform movements from 1820 to 1860 sought to expand democratic ideals because they wanted rights for women and enslaved people and they wanted to give everyone an education.

First, reformers wanted to end slavery. William Lloyd Garrison said he would be "as harsh as truth" and wanted the immediate freeing of slaves (Doc 2). Frederick Douglass said that the Fourth of July was a day that shows "the gross injustice and cruelty" done to slaves (Doc 7). Douglass was speaking to white Northerners who were celebrating freedom, so he wanted to make them feel guilty that slavery still existed. These two documents show abolitionists wanted to extend liberty to all people.

Second, women wanted equal rights. At Seneca Falls the women wrote that man has made "an absolute tyranny over her" (Doc 5). The writers used the words of the Declaration of Independence on purpose, because they wanted readers to see that women were being denied the same rights the founders fought for. They wanted the right to vote, which is the most basic democratic right.

Third, reformers wanted education for everyone. Horace Mann said education is "the great equalizer" (Doc 4). If all children could go to school, poor people could have a better chance to succeed. Dorothea Dix also wanted to help people in prisons and almshouses (Doc 3).

In conclusion reform movements wanted to expand democracy to women, slaves and the poor.`,
    scores: {
      thesis: {
        points: 1,
        confidence: 0.85,
        justification: "Defensible claim with three reasons: rights for women, rights for enslaved people and education.",
        studentFeedback:
          'Thesis: earned. Your claim that reformers "wanted rights for women and enslaved people" and education gives three clear reasons. Next time, add a qualifier such as largely or partly so your claim says how far reformers went.',
        quotes: ["wanted rights for women and enslaved people"],
      },
      contextualization: {
        points: 1,
        confidence: 0.8,
        justification:
          "Describes expanded white male suffrage, Jackson and the Second Great Awakening, and links them to the start of reform.",
        studentFeedback:
          'Contextualization: earned. You described how "More white men could vote after states dropped property requirements" and linked it to religious revivals. Next time, end that paragraph with one sentence that connects this context to your claim.',
        quotes: ["More white men could vote after states dropped property requirements"],
      },
      document_evidence: {
        points: 2,
        confidence: 0.82,
        justification: "Uses Documents 2, 4, 5 and 7 to support the three reasons in the thesis.",
        studentFeedback:
          'Evidence from the documents: earned 2 of 2 points. You used Documents 2, 4, 5 and 7 to support your reasons, such as Mann calling education "the great equalizer" in Document 4. Next time, explain how each quote proves your claim before you move to the next document.',
        quotes: ["as harsh as truth", "the great equalizer"],
      },
      outside_evidence: {
        points: 0,
        confidence: 0.78,
        justification:
          "The only outside evidence (Jackson and suffrage expansion) is used for contextualization, so it cannot also earn this point.",
        studentFeedback:
          'Evidence beyond the documents: not earned. Your only outside example is Jackson as "a champion of the common man" in your opening, and that counts as context. Next time, add one new fact to a body paragraph, such as the Underground Railroad, and explain how it supports your claim.',
        quotes: ["a champion of the common man"],
      },
      sourcing: {
        points: 1,
        confidence: 0.72,
        justification:
          "Explains Douglass's audience (Document 7) and the purpose behind the wording of Document 5, both tied to the argument.",
        studentFeedback:
          'Sourcing: earned. You explained that Douglass "was speaking to white Northerners who were celebrating freedom" and you explained the purpose of Document 5. Next time, add a sentence on how that audience makes the document stronger proof of your claim.',
        quotes: [
          "was speaking to white Northerners who were celebrating freedom",
          "The writers used the words of the Declaration of Independence on purpose",
        ],
      },
      complexity: {
        points: 0,
        confidence: 0.85,
        justification: "The argument is one-sided and the conclusion only restates the three reasons.",
        studentFeedback:
          'Complexity: not earned. Your conclusion says "reform movements wanted to expand democracy to women, slaves and the poor" without any limit or tension. Next time, explain one way reformers fell short, such as how school reform aimed at order more than voting rights.',
        quotes: ["reform movements wanted to expand democracy to women, slaves and the poor"],
      },
    },
  },
  {
    key: "dbq-03",
    studentFirstName: "Priya",
    studentLastName: "Natarajan",
    text: `Reform movements between 1820 and 1860 expanded democratic ideals to a large extent because abolitionists and women's rights activists demanded that the promises of the Declaration of Independence apply to everyone.

The abolitionists were the most important reformers. In Document 2, William Lloyd Garrison says he will not write "with moderation" about slavery and he wants the immediate enfranchisement of slaves. This shows that he wanted enslaved people to become free citizens right away, not slowly. In Document 7, Frederick Douglass asks what the Fourth of July means to a slave and answers that "your boasted liberty" is "an unholy license." Douglass is saying that American freedom is fake as long as slavery exists. In 1850 Congress passed the Fugitive Slave Act, which forced Northerners to return escaped slaves, and many abolitionists refused to obey it. This made the fight over slavery even more about whether America really believed in liberty.

Henry David Thoreau also says that when laws are unjust a person should not just obey them (Doc 6). He went to jail instead of paying a tax that supported the Mexican War and slavery. This shows reformers thought individual conscience was more important than unfair laws.

Women's rights reformers also used democratic ideas. The Declaration of Sentiments says "all men and women are created equal" (Doc 5). The women at Seneca Falls complained that they had to obey laws "in the formation of which she had no voice." This means they wanted the right to vote so they could have a say in the government like men.

In conclusion, the reform movements tried very hard to expand democratic ideals, especially the abolitionists and women's rights movement, who wanted freedom and equality for everyone.`,
    scores: {
      thesis: {
        points: 1,
        confidence: 0.88,
        justification: "Defensible claim about extent with two reasons that organize the body paragraphs.",
        studentFeedback:
          'Thesis: earned. Your claim says reform worked "to a large extent" because "abolitionists and women\'s rights activists demanded that the promises of the Declaration of Independence apply to everyone" and that sets up your body paragraphs. Next time, make sure every body paragraph matches one part of the claim, since Thoreau does not fit either part.',
        quotes: [
          "to a large extent",
          "abolitionists and women's rights activists demanded that the promises of the Declaration of Independence apply to everyone",
        ],
      },
      contextualization: {
        points: 0,
        confidence: 0.9,
        justification: "The essay opens directly with the thesis and never describes the broader developments of the period.",
        studentFeedback:
          'Contextualization: not earned. Your essay starts with your claim, "Reform movements between 1820 and 1860 expanded democratic ideals to a large extent" and never sets the scene. Next time, open with two or three sentences on what came before, such as the Second Great Awakening, and link it to reform.',
        quotes: ["Reform movements between 1820 and 1860 expanded democratic ideals to a large extent"],
      },
      document_evidence: {
        points: 2,
        confidence: 0.84,
        justification: "Uses Documents 2, 5, 6 and 7 to support the argument and explains what each shows.",
        studentFeedback:
          'Evidence from the documents: earned 2 of 2 points. You used four documents and explained them, as when you wrote that "American freedom is fake as long as slavery exists" about Document 7. Next time, bring in Document 3 or 4 to test whether other reforms fit your claim.',
        quotes: ["your boasted liberty", "all men and women are created equal", "American freedom is fake as long as slavery exists"],
      },
      outside_evidence: {
        points: 1,
        confidence: 0.86,
        justification: "The Fugitive Slave Act of 1850 is specific outside evidence tied to the argument about liberty.",
        studentFeedback:
          'Evidence beyond the documents: earned. You described how "In 1850 Congress passed the Fugitive Slave Act" and connected resistance to it to your argument about liberty. Next time, add a second outside example to your women\'s rights paragraph to support that part of your claim too.',
        quotes: ["In 1850 Congress passed the Fugitive Slave Act, which forced Northerners to return escaped slaves"],
      },
      sourcing: {
        points: 0,
        confidence: 0.8,
        justification: "Documents are summarized, but no point of view, purpose, audience or historical situation is explained.",
        studentFeedback:
          'Sourcing: not earned. You report what authors say, as in "William Lloyd Garrison says he will not write" with moderation, but not why they said it. Next time, explain for two documents how the purpose or audience shapes the message, for example why Douglass spoke on the Fourth of July.',
        quotes: ["William Lloyd Garrison says he will not write"],
      },
      complexity: {
        points: 0,
        confidence: 0.82,
        justification: "The essay argues one side throughout and does not weigh limits or differences between movements.",
        studentFeedback:
          'Complexity: not earned. Your conclusion says reformers "tried very hard to expand democratic ideals" without weighing how far they got. Next time, add a paragraph that explains one limit, such as how the Seneca Falls demands went unmet for decades, and support it with a document.',
        quotes: ["tried very hard to expand democratic ideals"],
      },
    },
  },
  {
    key: "dbq-04",
    studentFirstName: "Ethan",
    studentLastName: "Kowalski",
    text: `Reform movements from 1820 to 1860 wanted to make America better and more democratic by helping people who were treated unfairly, like slaves, women and the mentally ill.

Dorothea Dix talks about people who are "forgotten, insane, and idiotic men and women" and how they were kept in prisons (Doc 3). She was writing to the legislature of Massachusetts because they had the power to pay for hospitals, so she described the conditions to shock them. This was a reform to help people who could not help themselves.

Horace Mann wanted public schools for everyone. He says education gives each man "the independence and the means by which he can resist the selfishness of other men" (Doc 4). He thought school would make people more equal. Before this, many children in poor families had to work instead of going to school, so public schools gave them a chance.

The Seneca Falls Declaration was about women. It says that men have never let women vote. The women at the convention said that men treat them unfairly and want more rights, like voting and being able to own property.

Charles Finney says a revival is not a miracle (Doc 1). He was a preacher and people listened to him. This shows that religion was a part of reform.

Overall reformers wanted to help people and make the country more fair for everyone. They believed in democracy and equality and that is why they started all of these movements. Even though not every movement succeeded, they all tried to live up to the ideals in the Declaration of Independence.`,
    scores: {
      thesis: {
        points: 1,
        confidence: 0.7,
        justification: "Defensible claim that names three groups, though the essay never develops the first group.",
        studentFeedback:
          'Thesis: earned. Your claim that reformers helped "people who were treated unfairly, like slaves, women and the mentally ill" answers the prompt and names your groups. Next time, write a body paragraph for each group you name, since slavery never gets its own paragraph.',
        quotes: ["people who were treated unfairly, like slaves, women and the mentally ill"],
      },
      contextualization: {
        points: 0,
        confidence: 0.9,
        justification: "No paragraph describes the broader historical situation; the essay begins with the thesis.",
        studentFeedback:
          'Contextualization: not earned. Your first sentence, "Reform movements from 1820 to 1860 wanted to make America better" is your claim, and no paragraph describes the period around it. Next time, start with two or three sentences on changes like growing cities or religious revivals that pushed people toward reform.',
        quotes: ["Reform movements from 1820 to 1860 wanted to make America better"],
      },
      document_evidence: {
        points: 1,
        confidence: 0.75,
        justification:
          "Accurately describes Documents 1, 3, 4 and 5, but only Documents 3 and 4 are used to support a claim, so the row stays at 1 point.",
        studentFeedback:
          'Evidence from the documents: earned 1 of 2 points. You described four documents, and Mann\'s line about "the independence and the means" to resist others supports your claim well. Next time, explain how Documents 1 and 5 prove your thesis instead of only saying what they say.',
        quotes: ["the independence and the means by which he can resist the selfishness of other men"],
      },
      outside_evidence: {
        points: 0,
        confidence: 0.85,
        justification: "No specific evidence beyond the documents; the Finney detail is general.",
        studentFeedback:
          'Evidence beyond the documents: not earned. Everything comes from the documents, and "He was a preacher and people listened to him" is too general to count. Next time, add one specific fact from class, such as the founding of the American Temperance Society in 1826, and explain how it supports your claim.',
        quotes: ["He was a preacher and people listened to him"],
      },
      sourcing: {
        points: 1,
        confidence: 0.55,
        justification:
          "Dix's audience and purpose are explained well; the Finney line names his role but barely explains its relevance, so the second document is borderline.",
        studentFeedback:
          'Sourcing: earned. You explained Dix\'s audience well: "She was writing to the legislature of Massachusetts because they had the power to pay for hospitals" and why she described the conditions. Next time, explain a second document just as clearly, for example why a preacher like Finney would see reform as a religious duty.',
        quotes: [
          "She was writing to the legislature of Massachusetts because they had the power to pay for hospitals",
          "she described the conditions to shock them",
        ],
      },
      complexity: {
        points: 0,
        confidence: 0.88,
        justification: "The argument is general and one-sided, with no qualification or comparison.",
        studentFeedback:
          'Complexity: not earned. Your conclusion says reformers wanted "to help people and make the country more fair for everyone" without weighing any limits. Next time, add a paragraph that compares two movements, such as abolition and school reform, and support it with documents.',
        quotes: ["to help people and make the country more fair for everyone"],
      },
    },
  },
  {
    key: "dbq-05",
    studentFirstName: "Jordan",
    studentLastName: "Whitfield",
    text: `Reform movements in the United States from 1820 to 1860 sought to expand democratic ideals in many ways. There were many reform movements during this time and they all had different goals.

One reform movement was abolition. William Lloyd Garrison wrote a newspaper called The Liberator and he was against slavery (Doc 2). He said he will be "as uncompromising as justice." Frederick Douglass was also against slavery and he gave a speech about the Fourth of July (Doc 7). Many people joined these movements in the North.

Another reform movement was womens rights. In Document 5 the women wrote a declaration that was like the Declaration of Independence. They said all men and women are created equal.

Another reform was schools. In Document 4 Horace Mann talks about education. He calls it the "balance-wheel of the social machinery."

There was also a reform about prisons and the insane which was Dorothea Dix (Doc 3). She wanted the insane to be treated better. And Thoreau wrote about civil government (Doc 6). These are some of the reform movements that happened. Religion was also important because of Charles Finney (Doc 1).

Reform was a big part of the time period between 1820 and 1860. All of these reform movements were important to American history. They show that people wanted to change things in the country. Some of them worked and some of them did not work. In conclusion, reform movements in the United States from 1820 to 1860 sought to expand democratic ideals in many ways.`,
    scores: {
      thesis: {
        points: 0,
        confidence: 0.9,
        justification: "The opening restates the prompt without a claim or a line of reasoning.",
        studentFeedback:
          'Thesis: not earned. Your opening says reform "sought to expand democratic ideals in many ways" which repeats the prompt without making a claim. Next time, write one sentence that says how far reformers went and gives two reasons you will prove.',
        quotes: ["sought to expand democratic ideals in many ways"],
      },
      contextualization: {
        points: 0,
        confidence: 0.9,
        justification: "No description of the broader historical situation.",
        studentFeedback:
          'Contextualization: not earned. Your essay says "There were many reform movements during this time" but never describes what was happening in the country. Next time, write two or three sentences about the Second Great Awakening or the growth of factories, and explain how they led to reform.',
        quotes: ["There were many reform movements during this time"],
      },
      document_evidence: {
        points: 1,
        confidence: 0.6,
        justification:
          "Accurately describes the content of Documents 2, 4 and 5, meeting the three-document threshold; documents are listed by topic and never support an argument.",
        studentFeedback:
          'Evidence from the documents: earned 1 of 2 points. You described Documents 2, 4 and 5, such as Mann calling schools the "balance-wheel of the social machinery" but you did not use them to prove a claim. Next time, add a sentence after each document that ties it to your thesis.',
        quotes: ["balance-wheel of the social machinery", "as uncompromising as justice"],
      },
      outside_evidence: {
        points: 0,
        confidence: 0.88,
        justification: "No specific evidence beyond the documents.",
        studentFeedback:
          'Evidence beyond the documents: not earned. A line like "Many people joined these movements in the North" is too general to count. Next time, add one specific fact that is not in the documents, such as the Underground Railroad, and explain how it connects to your argument.',
        quotes: ["Many people joined these movements in the North"],
      },
      sourcing: {
        points: 0,
        confidence: 0.9,
        justification: "No point of view, purpose, audience or historical situation is explained for any document.",
        studentFeedback:
          'Sourcing: not earned. You mention that Douglass "gave a speech about the Fourth of July" but not why the date matters. Next time, explain for two documents how the audience or purpose shapes the message, for example why Douglass chose a patriotic holiday to criticize slavery.',
        quotes: ["gave a speech about the Fourth of July"],
      },
      complexity: {
        points: 0,
        confidence: 0.92,
        justification: "No argument is developed, so no complexity is possible.",
        studentFeedback:
          'Complexity: not earned. You wrote "Some of them worked and some of them did not work" but did not explain which or why. Next time, pick one movement that fell short and use a document to explain what held it back.',
        quotes: ["Some of them worked and some of them did not work"],
      },
    },
  },
  {
    key: "dbq-06",
    studentFirstName: "Sofia",
    studentLastName: "Marquez-Delgado",
    text: `In the 1800s the Second Great Awakening happened and many Americans became more religious. This led to reform movements. Reform movements from 1820 to 1860 expanded democratic ideals in some ways, because they fought for the rights of enslaved people and women, but many reformers were more interested in making people moral than in giving them political power.

Abolitionists wanted to expand democracy the most. Garrison called for "the immediate enfranchisement of our slave population" (Doc 2), which means making slaves free and part of the nation. Douglass said that to a slave, "your shouts of liberty and equality" are "hollow mockery" (Doc 7). This shows that Douglass thought American freedom did not apply to everyone. Nat Turner's rebellion in 1831 scared many Southerners and made them pass stricter slave codes, which made abolitionists even more determined.

Women also wanted more rights. The Seneca Falls Convention said man has "never permitted her to exercise her inalienable right to the elective franchise" (Doc 5). This means they wanted the vote, which was the most important way to take part in a democracy.

But some reforms were not about democracy. Finney said "Religion is the work of man" (Doc 1), which means people had to work to be good. Temperance reformers tried to stop people from drinking alcohol because they thought it caused poverty and crime. Groups like the American Temperance Society gave speeches and asked people to sign pledges to stop drinking. These reforms were about being moral, not about voting.

In conclusion, reform movements expanded democracy for some groups but a lot of reform was about morality instead.`,
    scores: {
      thesis: {
        points: 1,
        confidence: 0.85,
        justification: "Defensible, qualified claim that sets up rights-based reform against moral reform.",
        studentFeedback:
          'Thesis: earned. Your claim weighs both sides: reform helped enslaved people and women, but "many reformers were more interested in making people moral than in giving them political power." Next time, repeat that same idea in your conclusion so the reader sees your line of reasoning.',
        quotes: ["many reformers were more interested in making people moral than in giving them political power"],
      },
      contextualization: {
        points: 1,
        confidence: 0.5,
        justification:
          "Two short sentences link the Second Great Awakening to reform; this may be too brief to count as a description, so it needs a teacher check.",
        studentFeedback:
          'Contextualization: earned. You linked the Second Great Awakening to reform when you wrote "This led to reform movements." Next time, describe that context in more detail, for example what revival preachers taught about improving society, so the point is clearly earned.',
        quotes: [
          "In the 1800s the Second Great Awakening happened and many Americans became more religious",
          "This led to reform movements",
        ],
      },
      document_evidence: {
        points: 2,
        confidence: 0.8,
        justification: "Uses Documents 1, 2, 5 and 7 to support both sides of the argument.",
        studentFeedback:
          'Evidence from the documents: earned 2 of 2 points. You used Documents 1, 2, 5 and 7 to support both sides of your claim, and you explained Document 2 as "making slaves free and part of the nation." Next time, explain Document 7 as clearly as that one.',
        quotes: [
          "the immediate enfranchisement of our slave population",
          "never permitted her to exercise her inalienable right to the elective franchise",
          "making slaves free and part of the nation",
        ],
      },
      outside_evidence: {
        points: 1,
        confidence: 0.82,
        justification: "Nat Turner's rebellion and temperance reform are specific outside evidence tied to the argument.",
        studentFeedback:
          'Evidence beyond the documents: earned. You described how "Nat Turner\'s rebellion in 1831 scared many Southerners" and connected it to the abolitionists. Next time, explain more directly how this event supports your claim about expanding democracy.',
        quotes: ["Nat Turner's rebellion in 1831 scared many Southerners and made them pass stricter slave codes"],
      },
      sourcing: {
        points: 0,
        confidence: 0.85,
        justification: "No point of view, purpose, audience or historical situation is explained for any document.",
        studentFeedback:
          'Sourcing: not earned. You quote what "Douglass said that to a slave" but not why he said it or to whom. Next time, explain for two documents how the author\'s purpose or audience matters, for example why the Seneca Falls women copied the Declaration of Independence.',
        quotes: ["Douglass said that to a slave"],
      },
      complexity: {
        points: 0,
        confidence: 0.62,
        justification:
          "The moral reform paragraph qualifies the argument, but the tension is confined to one paragraph rather than running through the essay.",
        studentFeedback:
          'Complexity: not earned. Your idea that some reforms "were about being moral, not about voting" is strong, but it stays in one paragraph. Next time, carry that tension through the whole essay, for example by asking whether abolitionists also had moral goals.',
        quotes: ["were about being moral, not about voting"],
      },
    },
  },
  {
    key: "dbq-07",
    studentFirstName: "Tyler",
    studentLastName: "Nguyen",
    text: `In the early 1800s the United States was growing quickly. New canals like the Erie Canal and new railroads connected farms to cities, and factories in places like Lowell, Massachusetts hired thousands of young women. Cities grew crowded and many people worried about drinking, crime and poverty. At the same time, the Second Great Awakening convinced people that they could improve themselves and their communities. All of these changes led to a lot of reform movements.

There were many different reform movements and they all tried to change America.

The abolitionists wanted to end slavery. Douglass says that Americans celebrate liberty while slaves suffer "the gross injustice and cruelty" (Doc 7). Garrison also hated slavery and said he will "not wish to think, or speak, or write, with moderation" (Doc 2). Many people in the North agreed with them, but people in the South did not.

Women wanted to vote. The Declaration of Sentiments says women have no voice in making laws (Doc 5). The women at the convention said they wanted the same rights as men, including the right to vote.

Dorothea Dix wanted better treatment for the insane (Doc 3). She saw people kept in prisons and almshouses in terrible conditions. Horace Mann wanted schools (Doc 4). He thought that schools would help children from poor families.

These movements changed America a lot. They made people think about who should have rights. Some of these reforms took a long time to work, and some did not work until much later.`,
    scores: {
      thesis: {
        points: 0,
        confidence: 0.88,
        justification: "The claim does not answer whether or how far reform expanded democratic ideals.",
        studentFeedback:
          'Thesis: not earned. Your claim, "There were many different reform movements and they all tried to change America" does not say whether they expanded democratic ideals. Next time, take a position on how far reform went and give two reasons you will develop in your body paragraphs.',
        quotes: ["There were many different reform movements and they all tried to change America"],
      },
      contextualization: {
        points: 1,
        confidence: 0.87,
        justification:
          "The opening paragraph describes the transportation revolution, factories, urban problems and the Second Great Awakening and links them to reform.",
        studentFeedback:
          'Contextualization: earned. Your opening describes canals, factories and how "the Second Great Awakening convinced people that they could improve themselves" before reform began. Next time, keep this opening and add a sentence that leads straight into a clear claim.',
        quotes: [
          "factories in places like Lowell, Massachusetts hired thousands of young women",
          "the Second Great Awakening convinced people that they could improve themselves",
        ],
      },
      document_evidence: {
        points: 1,
        confidence: 0.74,
        justification:
          "Describes the content of Documents 2, 3, 4, 5 and 7, but none are used to support an argument.",
        studentFeedback:
          'Evidence from the documents: earned 1 of 2 points. You described what Documents 2, 5 and 7 say, such as Douglass on "the gross injustice and cruelty" of slavery. Next time, explain how each document supports a claim about democracy, and use at least four documents that way.',
        quotes: ["the gross injustice and cruelty", "not wish to think, or speak, or write, with moderation"],
      },
      outside_evidence: {
        points: 0,
        confidence: 0.8,
        justification:
          "Specific outside details (Erie Canal, Lowell) appear only in the context paragraph; the body uses no outside evidence.",
        studentFeedback:
          'Evidence beyond the documents: not earned. Your body paragraphs use only the documents, and "Many people in the North agreed with them" is too general. Next time, add one specific fact to a body paragraph, such as the Fugitive Slave Act of 1850, and explain how it supports your claim.',
        quotes: ["Many people in the North agreed with them"],
      },
      sourcing: {
        points: 0,
        confidence: 0.9,
        justification: "No point of view, purpose, audience or historical situation is explained for any document.",
        studentFeedback:
          'Sourcing: not earned. You say "Garrison also hated slavery" but not why his audience or purpose matters. Next time, explain for two documents why the author wrote it, for example that Garrison was launching his own antislavery newspaper.',
        quotes: ["Garrison also hated slavery"],
      },
      complexity: {
        points: 0,
        confidence: 0.9,
        justification: "No argument is developed, so the essay cannot show complexity.",
        studentFeedback:
          'Complexity: not earned. Your ending says the movements "made people think about who should have rights" without weighing their limits. Next time, explain one difference between two movements and support it with a document.',
        quotes: ["made people think about who should have rights"],
      },
    },
  },
  {
    key: "dbq-08",
    studentFirstName: "Aaliyah",
    studentLastName: "Brooks",
    text: `Reform movements between 1820 and 1860 only partly expanded democratic ideals. Abolitionists and women's rights activists demanded that liberty and equality apply to everyone, but reformers of schools and asylums mostly tried to make society more orderly, and even radical reformers often disagreed about how far democracy should reach.

The most radical reformers used democratic ideals as a weapon. The women at Seneca Falls rewrote the Declaration of Independence to say "all men and women are created equal" and listed the right to vote as a grievance (Doc 5). Douglass told his audience that their "denunciations of tyrants" were "brass fronted impudence" as long as slavery lasted (Doc 7). Both used America's founding words to show it had not lived up to them. However, these movements did not always agree with each other. After the Civil War, some abolitionists supported voting rights for Black men before women, which split the movement for women's suffrage.

Other reformers wanted to change individuals more than the government. Finney taught that "Religion is the work of man" (Doc 1), so believers thought sin could be beaten through effort. Horace Mann believed education was "the balance-wheel of the social machinery" (Doc 4). That image shows that Mann cared about keeping society balanced and stable, not only about equality. Dix also asked the state to take care of the insane (Doc 3), which expanded the role of government but did not give anyone a political voice.

Thoreau shows a different side. He says that a just man should go to prison under an unjust government (Doc 6). This rejects majority rule when the majority is wrong, which complicates the idea that reform was about democracy at all.

In the end, reform expanded democratic ideals for some groups, but many reformers valued morality, order or individual conscience more than equal political rights.`,
    scores: {
      thesis: {
        points: 1,
        confidence: 0.93,
        justification: "Qualified, defensible claim that sets up radical reform against reform aimed at order.",
        studentFeedback:
          'Thesis: earned. Your claim that reform "only partly expanded democratic ideals" answers the prompt and sets up two kinds of reformers. Next time, give Thoreau a place in the claim too, since he gets his own paragraph.',
        quotes: ["only partly expanded democratic ideals"],
      },
      contextualization: {
        points: 0,
        confidence: 0.85,
        justification: "The essay opens with the thesis and never describes the broader historical situation.",
        studentFeedback:
          'Contextualization: not earned. Your first sentence, "Reform movements between 1820 and 1860 only partly expanded democratic ideals" is your claim, and nothing before it describes the period. Next time, open with two or three sentences on a development like the Second Great Awakening and connect it to your claim.',
        quotes: ["Reform movements between 1820 and 1860 only partly expanded democratic ideals"],
      },
      document_evidence: {
        points: 2,
        confidence: 0.88,
        justification: "Uses Documents 1, 3, 4, 5, 6 and 7 to support both sides of the argument, with explanation.",
        studentFeedback:
          'Evidence from the documents: earned 2 of 2 points. You used six documents and explained them, as when you read Mann\'s "balance-wheel of the social machinery" as a sign he cared about stability. Next time, explain Document 3 the same way, since right now you only summarize it.',
        quotes: ["the balance-wheel of the social machinery", "all men and women are created equal"],
      },
      outside_evidence: {
        points: 1,
        confidence: 0.66,
        justification:
          "The postwar split over suffrage is specific outside evidence used to show reformers disagreed; it falls after 1860 but supports the argument.",
        studentFeedback:
          'Evidence beyond the documents: earned. You explained that "some abolitionists supported voting rights for Black men before women" and used it to show reformers disagreed. Next time, also use an example from inside 1820 to 1860, such as the Liberty Party, to support your claim about this period.',
        quotes: ["some abolitionists supported voting rights for Black men before women, which split the movement for women's suffrage"],
      },
      sourcing: {
        points: 0,
        confidence: 0.8,
        justification: "Documents are interpreted well, but no author's purpose, audience or situation is explained.",
        studentFeedback:
          'Sourcing: not earned. You mention that "Douglass told his audience" something harsh, but you do not explain why that audience matters. Next time, for two documents, explain how the purpose or audience shapes the message, for example why a Fourth of July speech would hit white listeners hard.',
        quotes: ["Douglass told his audience"],
      },
      complexity: {
        points: 1,
        confidence: 0.55,
        justification:
          "The essay qualifies its argument throughout: radical versus orderly reform, disagreement among reformers and Thoreau's rejection of majority rule. Whether this is sustained enough for the point is a judgment call.",
        studentFeedback:
          'Complexity: earned. Your essay keeps weighing limits, and your Thoreau paragraph says this "complicates the idea that reform was about democracy at all." Next time, add one more document to that paragraph so the point has more support.',
        quotes: ["This rejects majority rule when the majority is wrong, which complicates the idea that reform was about democracy at all"],
      },
    },
  },
];

/* ------------------------------------------------------------------ */
/* AP Lang argument                                                    */
/* ------------------------------------------------------------------ */

export const DEMO_LANG: DemoAssignment = {
  essayType: "LANG_ARG",
  title: "The value of failure",
  promptText:
    "Some people say that the fastest way to learn a skill is to fail at it again and again. Others say that repeated failure mostly teaches people to give up. Write an essay that argues your position on the value of failure in learning. Use specific evidence from your reading, studies, experience or observation, and explain how your evidence supports your argument.",
  sources: [],
};

export const DEMO_LANG_ESSAYS: DemoEssay[] = [
  {
    key: "lang-01",
    studentFirstName: "Benjamin",
    studentLastName: "Adeyemi",
    text: `Failure is often treated as the opposite of learning, but in most skills it is the main way people learn. Failing repeatedly is valuable when the learner can see why they failed and has a reason to try again; without those two conditions, failure only teaches people to quit.

The clearest example is learning a sport. When I joined the swim team in ninth grade, I was disqualified in my first three breaststroke races for an illegal kick. Each disqualification came with a slip from the official that named the exact problem, and my coach filmed my kick the next morning. Because I knew what went wrong, the failures were useful information, and by the fourth meet my kick was legal. The failure itself did not teach me anything; the feedback attached to it did.

Science works the same way. Thomas Edison's team tested thousands of materials before finding a filament that would last in a light bulb. Each failed material told them something specific about heat and resistance, so the failures narrowed the search. Edison could keep going because he had funding, a lab and a clear goal, which made failure affordable.

But failure without feedback or support has the opposite effect. Many students who fail their first algebra test decide they are "not math people" and stop trying. Their failure gave them a grade, but not an explanation, so the only lesson they took was about themselves rather than about algebra. In this case, repeated failure would not build skill; it would only confirm the belief that trying is pointless.

So the value of failure depends on what surrounds it. Teachers, coaches and parents who want students to learn from failure should make it specific and low-stakes, because failure only teaches when the learner can read it.`,
    scores: {
      thesis: {
        points: 1,
        confidence: 0.94,
        justification: "Defensible, conditional position that sets up the essay's line of reasoning.",
        studentFeedback:
          'Thesis: earned. Your claim that failure "is valuable when the learner can see why they failed and has a reason to try again" takes a clear, arguable position. Next time, keep building conditions like these into your thesis, since they give the essay its structure.',
        quotes: ["is valuable when the learner can see why they failed and has a reason to try again"],
      },
      evidence_commentary: {
        points: 4,
        confidence: 0.86,
        justification:
          "Three specific examples each support a claim in the line of reasoning, and the commentary consistently explains how each supports the conditions in the thesis.",
        studentFeedback:
          'Evidence and commentary: earned 4 of 4 points. Each example is specific and explained, as in "The failure itself did not teach me anything; the feedback attached to it did." Next time, give the Edison example one concrete detail, such as a material his team tried, to match your swim example.',
        quotes: [
          "The failure itself did not teach me anything; the feedback attached to it did",
          "Each failed material told them something specific about heat and resistance",
        ],
      },
      sophistication: {
        points: 1,
        confidence: 0.72,
        justification:
          "Explores the tension between helpful and harmful failure throughout and ends by naming the conditions that decide it.",
        studentFeedback:
          'Sophistication: earned. You explain when failure helps and when it hurts, ending with "So the value of failure depends on what surrounds it." Next time, push one step further by explaining who is responsible for making failure useful, and why.',
        quotes: ["So the value of failure depends on what surrounds it"],
      },
    },
  },
  {
    key: "lang-02",
    studentFirstName: "Hannah",
    studentLastName: "Lindqvist",
    text: `Failing over and over is one of the best ways to learn a skill because it shows you what does not work and makes you stronger.

First, failure shows you what you are doing wrong. When I was learning to play guitar, I could not play the F chord for weeks. Every time I tried, the strings buzzed. After a while I figured out that my first finger was not pressing hard enough across all six strings. If I had never failed, I would never have figured out how to fix my finger position. This shows that failing teaches you the exact thing you need to change.

Second, failure makes you more determined. Michael Jordan was cut from his high school varsity team as a sophomore. Instead of quitting, he practiced harder and became one of the best basketball players of all time. Failing made him want to prove people wrong. He later said that being cut was what pushed him to practice every morning before school. Many successful people say their failures pushed them to work harder.

Third, failure helps you deal with real life. In the real world, people fail at jobs, tests and relationships all the time. If you learn to fail in school, you will be ready for these problems later. For example, a lot of businesses fail in their first year, and the owners who succeed are often the ones who tried again.

In conclusion, failing many times is the best way to learn a skill because it teaches you what is wrong and makes you more determined to succeed.`,
    scores: {
      thesis: {
        points: 1,
        confidence: 0.9,
        justification: "Clear, defensible position with two stated reasons.",
        studentFeedback:
          'Thesis: earned. Your claim that "Failing over and over is one of the best ways to learn a skill" takes a clear position and gives reasons. Next time, add one limit to your claim, such as when failure stops helping, so your argument is harder to knock down.',
        quotes: ["Failing over and over is one of the best ways to learn a skill"],
      },
      evidence_commentary: {
        points: 3,
        confidence: 0.78,
        justification:
          "The guitar example is specific and well explained; the Jordan and business examples are relevant, but the commentary on them is thin and partly general.",
        studentFeedback:
          'Evidence and commentary: earned 3 of 4 points. Your guitar example is specific and explained, down to "my first finger was not pressing hard enough across all six strings." Next time, explain the business example the same way by saying what one owner learned from failing.',
        quotes: [
          "my first finger was not pressing hard enough across all six strings",
          "Many successful people say their failures pushed them to work harder",
        ],
      },
      sophistication: {
        points: 0,
        confidence: 0.84,
        justification: "The argument is one-sided and never considers when failure does not help.",
        studentFeedback:
          'Sophistication: not earned. Your argument stays one-sided, as in "If you learn to fail in school, you will be ready for these problems later" with no case where failure hurts. Next time, add a paragraph about someone who quit after failing, and explain how your argument handles it.',
        quotes: ["If you learn to fail in school, you will be ready for these problems later"],
      },
    },
  },
  {
    key: "lang-03",
    studentFirstName: "Marcus",
    studentLastName: "Bell",
    text: `I believe that failure is not always good for learning, because too much failure can make people give up.

A lot of people say that failure is the best teacher. But if you fail too many times, you might stop trying. For example, if a student keeps failing tests, they might think they are dumb and not want to study anymore. This happens to a lot of students in school.

Also, failure can be embarrassing. If you fail in front of other people, like missing a free throw in a big game, people might laugh at you. This makes you not want to try again. Nobody likes to be embarrassed.

On the other hand, some failure can be good. When my little brother was learning to ride a bike, he fell a lot, but he kept trying and eventually he learned. My parents ran behind him and held the seat at first, which helped him feel safe. So sometimes failure is okay if it is not too much.

Failure can also be stressful. Stress is bad for your health and can make it hard to learn new things. Students already have a lot of stress from school and do not need more. Some students even get sick from too much stress before big tests. This is why failing over and over is not a good idea for most people.

In conclusion, failure is not always good for learning because too much failure can make people give up and feel bad about themselves. People should try to succeed instead of failing all the time.`,
    scores: {
      thesis: {
        points: 1,
        confidence: 0.82,
        justification: "Takes a defensible position with a reason.",
        studentFeedback:
          'Thesis: earned. Your claim that "too much failure can make people give up" takes a position someone could argue against. Next time, name the point where failure stops helping, so your reader knows exactly what you are arguing.',
        quotes: ["too much failure can make people give up"],
      },
      evidence_commentary: {
        points: 2,
        confidence: 0.7,
        justification:
          "Evidence is mostly hypothetical apart from the bike example; commentary relates some evidence to the claim, but the paragraphs do not build a clear line of reasoning.",
        studentFeedback:
          'Evidence and commentary: earned 2 of 4 points. Your bike example is specific, but other evidence is made up, like "if a student keeps failing tests, they might think they are dumb" in your second paragraph. Next time, replace one made-up example with something that really happened, and explain how it proves your claim.',
        quotes: [
          "if a student keeps failing tests, they might think they are dumb",
          "When my little brother was learning to ride a bike, he fell a lot",
        ],
      },
      sophistication: {
        points: 0,
        confidence: 0.86,
        justification: "Names the other side but does not explore it.",
        studentFeedback:
          'Sophistication: not earned. You start to explore the other side with "So sometimes failure is okay if it is not too much" but stop there. Next time, explain what makes the difference between helpful and harmful failure, and use your bike example to show it.',
        quotes: ["So sometimes failure is okay if it is not too much"],
      },
    },
  },
  {
    key: "lang-04",
    studentFirstName: "Chloe",
    studentLastName: "Fitzgerald",
    text: `Failure is something that happens to everyone in their life. Some people think failure is good and some people think it is bad. There are many different opinions about failure and learning.

Failure happens in school, sports and jobs. Everybody fails at something at some point. Some famous people failed before they were successful, like inventors and athletes. Failing is part of life and you cannot avoid it.

When people fail they can learn from it or they can give up. It depends on the person. Some people are more motivated than others. Everyone is different and handles failure in their own way. Some people learn better from failing and some people learn better from succeeding.

For example, when you take a test and get a bad grade, you can look at what you got wrong. Or you can just throw the test away. Teachers usually want students to look at their mistakes so they can do better next time. But some students do not care about their grades.

Failure is also different depending on how big it is. Failing a small quiz is not as bad as failing a whole class.

There are good things and bad things about failure. A good thing is that you can learn what you did wrong. A bad thing is that it can make you feel sad. People should think about both sides when they think about failure.

In conclusion, failure is a part of life and everyone experiences it. Whether it helps you learn depends on you.`,
    scores: {
      thesis: {
        points: 0,
        confidence: 0.88,
        justification: "Describes both sides but never takes a position.",
        studentFeedback:
          'Thesis: not earned. Your essay says "There are many different opinions about failure and learning" but never picks one. Next time, write one sentence near the start that says whether failure helps people learn and why.',
        quotes: ["There are many different opinions about failure and learning"],
      },
      evidence_commentary: {
        points: 1,
        confidence: 0.8,
        justification:
          "Evidence is general throughout (unnamed famous people, a generic test) and is summarized rather than explained in support of a position.",
        studentFeedback:
          'Evidence and commentary: earned 1 of 4 points. Your examples stay general, such as "Some famous people failed before they were successful, like inventors and athletes." Next time, name one real person or event, give one detail about what happened, and explain how it supports your position.',
        quotes: [
          "Some famous people failed before they were successful, like inventors and athletes",
          "when you take a test and get a bad grade, you can look at what you got wrong",
        ],
      },
      sophistication: {
        points: 0,
        confidence: 0.9,
        justification: "Names a complexity in the last line but does not explore it.",
        studentFeedback:
          'Sophistication: not earned. Your ending, "Whether it helps you learn depends on you" names a complexity but does not explore it. Next time, choose a clear position first, then explain one case that challenges it.',
        quotes: ["Whether it helps you learn depends on you"],
      },
    },
  },
];

/* ------------------------------------------------------------------ */
/* Roster                                                              */
/* ------------------------------------------------------------------ */

/** 32 invented names for the demo class. Includes every essay author above. */
export const DEMO_ROSTER: DemoStudentName[] = [
  { firstName: "Maya", lastName: "Okafor" },
  { firstName: "Daniel", lastName: "Reyes" },
  { firstName: "Priya", lastName: "Natarajan" },
  { firstName: "Ethan", lastName: "Kowalski" },
  { firstName: "Jordan", lastName: "Whitfield" },
  { firstName: "Sofia", lastName: "Marquez-Delgado" },
  { firstName: "Tyler", lastName: "Nguyen" },
  { firstName: "Aaliyah", lastName: "Brooks" },
  { firstName: "Benjamin", lastName: "Adeyemi" },
  { firstName: "Hannah", lastName: "Lindqvist" },
  { firstName: "Marcus", lastName: "Bell" },
  { firstName: "Chloe", lastName: "Fitzgerald" },
  { firstName: "Alexandria", lastName: "Papadopoulos-Whitmore" },
  { firstName: "Jun", lastName: "Park" },
  { firstName: "Fatima", lastName: "Al-Sayed" },
  { firstName: "Kwame", lastName: "Mensah" },
  { firstName: "Isabella", lastName: "Rossi" },
  { firstName: "Noah", lastName: "Goldberg" },
  { firstName: "Mei Lin", lastName: "Chen" },
  { firstName: "Diego", lastName: "Hernandez" },
  { firstName: "Grace", lastName: "O'Connor" },
  { firstName: "Samuel", lastName: "Abebe" },
  { firstName: "Leilani", lastName: "Kahale" },
  { firstName: "Oliver", lastName: "Thompson" },
  { firstName: "Zainab", lastName: "Haddad" },
  { firstName: "Lucas", lastName: "Ferreira" },
  { firstName: "Emily", lastName: "Johansson" },
  { firstName: "Ravi", lastName: "Patel" },
  { firstName: "Anastasia", lastName: "Volkonskaya" },
  { firstName: "Malik", lastName: "Washington" },
  { firstName: "Ximena", lastName: "Castillo" },
  { firstName: "Maximiliano", lastName: "Echeverria-Santos" },
];
