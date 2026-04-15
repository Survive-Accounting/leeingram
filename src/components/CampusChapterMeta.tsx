import { Helmet } from "react-helmet-async";

interface CampusChapterMetaProps {
  campusName: string;
  campusSlug: string;
  courseName: string;
  courseSlug: string;
  chapterNumber: number;
  chapterName: string;
}

export default function CampusChapterMeta({
  campusName,
  campusSlug,
  courseName,
  courseSlug,
  chapterNumber,
  chapterName,
}: CampusChapterMetaProps) {
  const title = `Chapter ${chapterNumber}: ${chapterName} | ${courseName} | ${campusName} | Survive Accounting`;
  const description = `Practice problems and exam prep for Chapter ${chapterNumber} ${chapterName} at ${campusName}. Step-by-step explanations trusted by 1,000+ students.`;
  const canonical = `https://learn.surviveaccounting.com/campus/${campusSlug}/${courseSlug}/chapter-${chapterNumber}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
}
