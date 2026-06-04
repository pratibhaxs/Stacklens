// app/report/[id]/page.js
// Public report page — no authentication required.
// Anyone with the link can view this page.
export const dynamic = 'force-dynamic'

import ReportClient from './ReportClient'

export default function ReportPage({ params }) {
  return <ReportClient scanId={params.id} />
}
