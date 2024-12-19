import { useMutation, useQuery } from "@tanstack/react-query";

export const useSendFax = () => {
  return useMutation({
    mutationFn: async ({
      files,
      countryCode,
      recipientNumber,
      paymentIntentId,
    }: {
      files: File[];
      countryCode: string;
      recipientNumber: string;
      paymentIntentId: string;
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
  return useQuery({
    queryKey: ['faxStatus', transactionId],
    queryFn: async () => {
      const response = await fetch(`/api/fax-status/${transactionId}`);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    enabled: !!transactionId,
    refetchInterval: (data) => 
      data?.status === 'processing' ? 2000 : false,
  });
};
