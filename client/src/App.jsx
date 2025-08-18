import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Container,
  Card,
  CardContent,
  CardActions,
  Grid,
  Typography,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Stack,
  Box,
  IconButton,
} from "@mui/material";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";

// CONFIG
const API_URL = import.meta.env.VITE_API_URL || "https://your.api/";
const razorpayKey = "rzp_test_WrEHxWwQWGpjH8";

// Helpers
const calculateTwentyPercent = (base, percent) => (base * percent) / 100;

const loadRazorpaySDK = (onload) => {
  if (document.getElementById("razorpay-sdk")) {
    onload();
    return;
  }
  const script = document.createElement("script");
  script.id = "razorpay-sdk";
  script.src = "https://checkout.razorpay.com/v1/checkout.js";
  script.async = true;
  script.onload = onload;
  script.onerror = () => alert("Failed to load Razorpay SDK");
  document.body.appendChild(script);
};

// Optional: post-payment hook
const createOrder = () => {
  // implement your flow (e.g., navigate to success page, refresh data)
};

export default function App() {
  // Theme: auto from system, with optional manual override
  const prefersDark = window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const [mode, setMode] = useState(prefersDark ? "dark" : "light");
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setMode(e.matches ? "dark" : "light");
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, []);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: "#FF4B26" }, // brand color
        },
        shape: { borderRadius: 12 },
        components: {
          MuiCard: {
            styleOverrides: {
              root: {
                border: `1px solid`,
                borderColor: mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                boxShadow:
                  mode === "dark"
                    ? "0 10px 24px rgba(0,0,0,0.5)"
                    : "0 10px 24px rgba(0,0,0,0.06)",
              },
            },
          },
          MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: { root: { fontWeight: 700 } },
          },
          MuiTextField: {
            defaultProps: { size: "medium", fullWidth: true },
          },
          MuiSelect: { defaultProps: { fullWidth: true } },
        },
      }),
    [mode]
  );

  // Form state
  const [selectedOption, setSelectedOption] = useState("optionA");
  const [selectedDenomination, setSelectedDenomination] = useState(5500);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [isPaymentDone, setIsPaymentDone] = useState(false);

  // Derived amount
  const payableAmount = useMemo(
    () =>
      selectedOption === "optionA"
        ? calculateTwentyPercent(5500, 20)
        : calculateTwentyPercent(5500, 50),
    [selectedOption]
  );
  const amountInPaise = Math.round(payableAmount * 100);

  // Validation
  const emailOk = /^\S+@\S+\.\S+$/.test(email);
  const phoneOk = /^\d{10}$/.test(contact);
  const isFormValid =
    name.trim().length > 1 && emailOk && phoneOk && address.trim().length > 4 && amount.trim().length > 0;

  const handlePayment = async () => {
    if (!isFormValid) return;
    setIsPaying(true);

    try {
      // 1) Create order on server
      const orderResponse = await axios.post(`http://127.0.0.1:5000/api2/create_order`, {
        amount: amountInPaise,
        currency: "INR",
        willid: sessionStorage.getItem("draft_id"),
      });

      const { id: order_id, amount, currency } = orderResponse.data;

      // 2) Open Razorpay
      const options = {
        key: razorpayKey,
        amount: amount.toString(),
        currency,
        name: "TECHOPTIMA PVT LTD",
        description: "Payment for Order",
        order_id,
        handler: async function (response) {
          try {
            // 3) Verify payment
            const paymentData = {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              will_id: sessionStorage.getItem("draft_id"),
              is_premium: true,
              value_of_draft: selectedDenomination,
              user_id: sessionStorage.getItem("userid"),
              amount: payableAmount,
            };

            const verifyResponse = await axios.post(
              `http://127.0.0.1:5000/api2/verify_payment`,
              paymentData
            );

            if (verifyResponse.data.message === "Payment verified successfully") {
              createOrder();
              setIsPaymentDone(true);
            } else {
              alert("Payment verification failed");
            }
          } catch (err) {
            console.error("Verification error", err);
            alert("Payment verification failed. Please contact support.");
          } finally {
            setIsPaying(false);
          }
        },
        prefill: { name, email, contact },
        notes: { address },
        theme: { color: "#FF4B26" },
        modal: { ondismiss: () => setIsPaying(false) },
      };

      loadRazorpaySDK(() => {
        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", function (resp) {
          console.error("Payment failed", resp.error);
          alert(resp.error?.description || "Payment failed. Please try again.");
          setIsPaying(false);
        });
        rzp.open();
      });
    } catch (error) {
      console.error("Payment init failed", error);
      alert("Payment initiation failed. Please try again.");
      setIsPaying(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          bgcolor: "background.default",
          color: "text.primary",
          py: 3,
        }}
        
      >
        <Container maxWidth="md">
          <Card>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 2 }}
              >
                <Typography variant="h5" fontWeight={700}>
                  Complete Payment
                </Typography>

                {/* Optional theme toggle */}
                <IconButton
                  color="inherit"
                  aria-label="toggle theme"
                  onClick={() => setMode((m) => (m === "dark" ? "light" : "dark"))}
                >
                  {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
                </IconButton>
              </Stack>

              <Grid container spacing={2} sx={{ mb: 1 }}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Full Name"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Email"
                    placeholder="john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={email.length > 0 && !emailOk}
                    helperText={
                      email.length > 0 && !emailOk ? "Enter a valid email" : " "
                    }
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Contact (10 digits)"
                    placeholder="9999999999"
                    value={contact}
                    onChange={(e) =>
                      setContact(e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    error={contact.length > 0 && !phoneOk}
                    helperText={
                      contact.length > 0 && !phoneOk
                        ? "Enter a valid 10-digit number"
                        : " "
                    }
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Address"
                    placeholder="Flat 1, Street, City"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Enter Amount"
                    placeholder="5000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Grid>
              </Grid>

              {/* <Grid container spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" sx={{ mb: 0.75, color: "text.secondary" }}>
                    Plan
                  </Typography>
                  <ToggleButtonGroup
                    fullWidth
                    color="primary"
                    exclusive
                    value={selectedOption}
                    onChange={(_, v) => v && setSelectedOption(v)}
                    sx={{
                      "& .MuiToggleButton-root": {
                        px: 2,
                        py: 1.2,
                        fontWeight: 600,
                        textTransform: "none",
                        borderRadius: 2,
                      },
                    }}
                  >
                    <ToggleButton value="optionA">Option A (20%)</ToggleButton>
                    <ToggleButton value="optionB">Option B (50%)</ToggleButton>
                  </ToggleButtonGroup>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel id="denom-label">Denomination</InputLabel>
                    <Select
                      labelId="denom-label"
                      label="Denomination"
                      value={selectedDenomination}
                      onChange={(e) => setSelectedDenomination(Number(e.target.value))}
                    >
                      <MenuItem value={5500}>₹5,500</MenuItem>
                      <MenuItem value={10000}>₹10,000</MenuItem>
                      <MenuItem value={20000}>₹20,000</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid> */}

              <Box
                sx={{
                  mt: 2,
                  p: 1.5,
                  border: "1px dashed",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: (t) =>
                    t.palette.mode === "dark"
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(0,0,0,0.02)",
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Typography variant="body2">Base: ₹5,500</Typography>
                  <Typography variant="body2">
                    Selected: {selectedOption === "optionA" ? "20%" : "50%"}
                  </Typography>
                  <Typography variant="body2">
                    Payable now:{" "}
                    <strong>₹{Number(payableAmount).toLocaleString()}</strong>
                  </Typography>
                </Stack>
              </Box>
            </CardContent>

            <CardActions sx={{ p: { xs: 2, sm: 3 }, pt: 0 }}>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                onClick={handlePayment}
                disabled={!isFormValid || isPaying}
              >
                {isPaying ? "Processing..." : "Pay Securely"}
              </Button>
            </CardActions>

            {isPaymentDone && (
              <Box sx={{ px: { xs: 2, sm: 3 }, pb: 3 }}>
                <Typography color="success.main" fontWeight={700}>
                  Payment complete. Thank you!
                </Typography>
              </Box>
            )}
          </Card>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
