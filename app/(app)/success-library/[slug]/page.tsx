import { redirect } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

/** Legacy Success Library article URLs → Help & Guides. */
export default async function SuccessLibraryArticleRedirectPage({ params }: Props) {
  const { slug } = await params;
  redirect(`/help/${slug}`);
}
