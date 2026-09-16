import io
import json
import runpy
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

class AuthError(Exception):
    pass

class FakeGarmin:
    fail = False
    need_mfa = False
    def __init__(self, email, password, prompt_mfa, **kwargs):
        self.prompt = prompt_mfa
    def login(self, directory):
        if self.fail:
            raise AuthError('sensitive-upstream-diagnostic')
        if self.need_mfa:
            assert self.prompt() == '123456'
        Path(directory, 'garmin_tokens.json').write_text('new-private-token')

class BridgeTests(unittest.TestCase):
    def invoke(self, directory, mfa=False, fail=False):
        FakeGarmin.need_mfa, FakeGarmin.fail = mfa, fail
        output = io.StringIO()
        source = io.StringIO(json.dumps({'command':'login','email':'test@example.com','password':'never-store-this'})+'\n'+json.dumps({'code':'123456'})+'\n')
        module = types.SimpleNamespace(Garmin=FakeGarmin, GarminConnectAuthenticationError=AuthError, GarminConnectTooManyRequestsError=type('RateError',(Exception,),{}))
        with patch.dict(sys.modules, {'garminconnect':module}), patch.object(sys,'argv',['bridge',directory]), patch.object(sys,'stdin',source), patch.object(sys,'stdout',output):
            runpy.run_path('server/garmin_bridge.py')
        return output.getvalue()
    def test_mfa_then_success_only_stores_token(self):
        with tempfile.TemporaryDirectory() as directory:
            text = self.invoke(directory,mfa=True)
            self.assertEqual(json.loads(text.splitlines()[0]),{'event':'mfa'})
            self.assertTrue(json.loads(text.splitlines()[1])['result']['connected'])
            self.assertNotIn('never-store-this',text)
            files = list(Path(directory).rglob('*'))
            self.assertEqual([p.name for p in files if p.is_file()],['garmin_tokens.json'])
    def test_failed_relogin_preserves_working_token_and_redacts_error(self):
        with tempfile.TemporaryDirectory() as directory:
            tokens=Path(directory,'garmin');tokens.mkdir()
            token=tokens/'garmin_tokens.json';token.write_text('old-working-token')
            text=self.invoke(directory,fail=True)
            self.assertEqual(token.read_text(),'old-working-token')
            self.assertNotIn('sensitive-upstream-diagnostic',text)
            self.assertIn('error',json.loads(text))

if __name__=='__main__':
    unittest.main()
