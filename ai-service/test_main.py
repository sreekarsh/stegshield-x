import io
import unittest
from fastapi.testclient import TestClient
from PIL import Image
from main import app, AI_API_KEY

class TestAIService(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.headers = {"Authorization": f"Bearer {AI_API_KEY}"}

    def test_health_endpoint(self):
        response = self.client.get("/health", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["service"], "stegshield-ai")

    def test_entropy_endpoint_valid_image(self):
        img = Image.new("RGB", (100, 100), color="blue")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        response = self.client.post(
            "/analyze/entropy",
            files={"file": ("test.png", buf.getvalue(), "image/png")},
            headers=self.headers
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("entropy", data)
        self.assertIn("suspicious", data)
        self.assertIsInstance(data["entropy"], (int, float))

    def test_stego_endpoint_valid_image(self):
        img = Image.new("RGB", (100, 100), color="green")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        response = self.client.post(
            "/analyze/stego",
            files={"file": ("test.png", buf.getvalue(), "image/png")},
            headers=self.headers
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("stego_probability", data)
        self.assertIn("filename", data)

    def test_unauthorized_request(self):
        # Request without auth header to protected endpoint should return 401
        response = self.client.post("/analyze/threat")
        self.assertEqual(response.status_code, 401)

if __name__ == "__main__":
    unittest.main()
