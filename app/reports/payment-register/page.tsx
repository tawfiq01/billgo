import { paymentRegister } from "@/lib/reports";
import { ReportTable } from "@/components/report-table";

export default async function PaymentRegisterReportPage() {
  const rows = await paymentRegister();

  return <ReportTable rows={rows} csvHref="/api/reports/payment-register" />;
}
