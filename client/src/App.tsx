import { Switch, Route } from "wouter";
import Home from "./pages/Home";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/success" component={PaymentSuccess} />
        <Route path="/cancel" component={PaymentCancel} />
      </Switch>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
