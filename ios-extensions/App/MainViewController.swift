// Registriert das eigene Plugin. In Main.storyboard die Klasse des
// „Bridge View Controller“ auf MainViewController setzen (Identity Inspector).
// Target Membership: App.
import UIKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SecondBrainNativePlugin())
    }
}
