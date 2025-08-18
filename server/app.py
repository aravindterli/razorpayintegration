import os
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_restx import Api, Namespace, Resource, fields
from flask_cors import CORS
import razorpay

# Load environment variables
load_dotenv()

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_SECRET_KEY = os.getenv("RAZORPAY_SECRET_KEY", "")

if not RAZORPAY_KEY_ID or not RAZORPAY_SECRET_KEY:
    raise RuntimeError("Set RAZORPAY_KEY_ID and RAZORPAY_SECRET_KEY in environment or .env")

# Flask app
app = Flask(__name__)
CORS(app)  # Allow frontend calls during development

api = Api(app, version="1.0", title="Razorpay API", description="Standard Razorpay order and verification API")

# Namespace /api2/razorpay to match your frontend paths
ns = Namespace("razorpay", description="Razorpay order and payment verification")
api.add_namespace(ns, path="/api2")

# Razorpay client
rz_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_SECRET_KEY))

# Request models (for API docs)
create_order_req = ns.model(
    "CreateOrderRequest",
    {
        "amount": fields.Integer(required=True, description="Amount in paise. e.g., 50000 for ₹500"),
        "currency": fields.String(required=False, default="INR", description="Currency code"),
        "receipt": fields.String(required=False, description="Optional receipt identifier"),
        "notes": fields.Raw(required=False, description="Optional notes object"),
    },
)

verify_payment_req = ns.model(
    "VerifyPaymentRequest",
    {
        "razorpay_order_id": fields.String(required=True),
        "razorpay_payment_id": fields.String(required=True),
        "razorpay_signature": fields.String(required=True),
        # Optional pass-through fields from your frontend if you need them for logging
        "amount": fields.Integer(required=False, description="Amount in paise (for your own logs)"),
        "metadata": fields.Raw(required=False, description="Any additional metadata"),
    },
)

@ns.route("/create_order")
class CreateOrder(Resource):
    @ns.expect(create_order_req)
    def post(self):
        """Create a Razorpay order"""
        data = request.get_json(force=True, silent=True) or {}
        amount = data.get("amount")
        currency = data.get("currency", "INR")
        receipt = data.get("receipt")
        notes = data.get("notes") or {}

        if not isinstance(amount, int) or amount <= 0:
            return {"error": "amount must be a positive integer in paise"}, 400

        try:
            order = rz_client.order.create(
                {
                    "amount": amount,      # amount in paise
                    "currency": currency,  # INR by default
                    "receipt": receipt,
                    "notes": notes,
                    "payment_capture": 1,  # auto-capture
                }
            )
            # Razorpay SDK returns a dict; forward it as-is
            return order, 200
        except razorpay.errors.BadRequestError as e:
            return {"error": "Bad request to Razorpay", "details": str(e)}, 400
        except razorpay.errors.ServerError as e:
            return {"error": "Razorpay server error", "details": str(e)}, 502
        except Exception as e:
            return {"error": "Unexpected error", "details": str(e)}, 500


@ns.route("/verify_payment")
class VerifyPayment(Resource):
    @ns.expect(verify_payment_req)
    def post(self):
        """Verify the Razorpay payment signature"""
        data = request.get_json(force=True, silent=True) or {}

        required = ["razorpay_order_id", "razorpay_payment_id", "razorpay_signature"]
        missing = [k for k in required if not data.get(k)]
        if missing:
            return {"error": f"Missing fields: {', '.join(missing)}"}, 400

        try:
            # Signature verification
            rz_client.utility.verify_payment_signature(
                {
                    "razorpay_order_id": data["razorpay_order_id"],
                    "razorpay_payment_id": data["razorpay_payment_id"],
                    "razorpay_signature": data["razorpay_signature"],
                }
            )

            # Optional: fetch payment details for your logs/audits
            payment = rz_client.payment.fetch(data["razorpay_payment_id"])

            # Return a minimal, standard response
            return {
                "message": "Payment verified successfully",
                "payment": {
                    "id": payment.get("id"),
                    "status": payment.get("status"),
                    "method": payment.get("method"),
                    "amount": payment.get("amount"),
                    "currency": payment.get("currency"),
                    "email": payment.get("email"),
                    "contact": payment.get("contact"),
                    "order_id": payment.get("order_id"),
                    "captured": payment.get("captured"),
                    "created_at": payment.get("created_at"),
                },
            }, 200

        except razorpay.errors.SignatureVerificationError:
            return {"error": "Payment verification failed"}, 400
        except razorpay.errors.BadRequestError as e:
            return {"error": "Bad request to Razorpay", "details": str(e)}, 400
        except razorpay.errors.ServerError as e:
            return {"error": "Razorpay server error", "details": str(e)}, 502
        except Exception as e:
            return {"error": "Unexpected error", "details": str(e)}, 500


def create_app():
    return app

if __name__ == "__main__":
    # For local dev
    app.run(host="0.0.0.0", port=5000, debug=True)
