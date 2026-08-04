import { apiFetch } from "./api";


export async function fetchLicenseRequests() {
  const res = await apiFetch(
    "/company/license/requests"
  );

  if (!res.ok) {
    throw new Error(
      "Failed to fetch license requests"
    );
  }

  return res.json();
}



export async function approveLicenseRequest(
  requestId: number
) {
  const res = await apiFetch(
    `/company/license/requests/${requestId}/approve`,
    {
      method: "PATCH",
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to approve license request"
    );
  }

  return res.json();
}



export async function rejectLicenseRequest(
  requestId: number,
  review_note?: string
) {
  const res = await apiFetch(
    `/company/license/requests/${requestId}/reject`,
    {
      method: "PATCH",
      body: JSON.stringify({
        review_note,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(
      "Failed to reject license request"
    );
  }

  return res.json();
}