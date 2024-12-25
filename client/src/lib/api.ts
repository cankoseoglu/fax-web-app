import { useMutation, useQuery, type QueryFunctionContext, type QueryKey } from "@tanstack/react-query";

interface FaxStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface SendFaxResponse {
  transactionId: string;
}

export const useSendFax = () => {
  return useMutation<SendFaxResponse, Error, {
    files: File[];
    countryCode: string;
    recipientNumber: string;
    paymentIntentId: string;
  }>({
    mutationFn: async ({
      files,
      countryCode,
      recipientNumber,
      paymentIntentId,
    }) => {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      formData.append("countryCode", countryCode);
      formData.append("recipientNumber", recipientNumber);
      formData.append("paymentIntentId", paymentIntentId);

      const response = await fetch("/api/send-fax", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
  });
};

export const useFaxStatus = (transactionId?: string) => {
  return useQuery<FaxStatus, Error, FaxStatus, [string, string | undefined]>({
    queryKey: ['faxStatus', transactionId],
    queryFn: async ({ queryKey }) => {
      const [, id] = queryKey;
      if (!id) throw new Error('No transaction ID provided');
      const response = await fetch(`/api/fax-status/${id}`);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    enabled: !!transactionId,
    refetchInterval: (query) => 
      query.state.data?.status === 'processing' ? 2000 : false,
  });
};
