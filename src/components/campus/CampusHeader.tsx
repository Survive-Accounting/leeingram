import { Helmet } from "react-helmet-async";
import SiteNavbar from "@/components/landing/SiteNavbar";

interface CampusHeaderProps {
  campusName: string;
  courseName: string;
}

export default function CampusHeader({ campusName, courseName }: CampusHeaderProps) {
  return (
    <>
      <Helmet>
        <title>{campusName ? `${campusName} | ` : ""}{courseName} Exam Prep | Survive Accounting</title>
        <meta
          name="description"
          content={`Practice problems and exam prep for ${courseName}${campusName ? ` at ${campusName}` : ""}. Trusted by 1,000+ students.`}
        />
      </Helmet>

      <SiteNavbar />
    </>
  );
}
