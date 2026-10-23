'use strict';
// Genera un preset .adv (XML de Live comprimido con gzip) de un MIDI Effect de Max que apunta al .amxd instalado.
// Sirve para cargar el dispositivo desde el navegador de Live como preset y desde herramientas que solo cargan
// presets (.adv/.adg), como Producer Pal. La lista de parámetros va vacía: Live la reconstruye desde el patch.
// Estructura tomada de un .adv real del equipo (Sidera_WaveSeq.adv, Live 12.4.6).
// Uso: node tools/make_adv.js <ruta absoluta del .amxd> <salida.adv>
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const os = require('os');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// kind: 'midi' (MxDeviceMidiEffect) o 'audio' (MxDeviceAudioEffect, para SV Listen)
function advXml(amxdPath, kind = 'midi') {
  const tag = kind === 'audio' ? 'MxDeviceAudioEffect' : 'MxDeviceMidiEffect';
  const abs = amxdPath.replace(/\\/g, '/');
  const userLib = path.join(os.homedir(), 'Documents', 'Ableton', 'User Library').replace(/\\/g, '/') + '/';
  const rel = abs.startsWith(userLib) ? abs.slice(userLib.length) : '';
  const size = fs.existsSync(amxdPath) ? fs.statSync(amxdPath).size : 0;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5" MinorVersion="12.0_12402" SchemaChangeCount="5" Creator="Ableton Live 12.4.6" Revision="">
	<${tag}>
		<LomId Value="0" />
		<LomIdView Value="0" />
		<IsExpanded Value="true" />
		<BreakoutIsExpanded Value="false" />
		<On>
			<LomId Value="0" />
			<Manual Value="true" />
			<AutomationTarget Id="0">
				<LockEnvelope Value="0" />
			</AutomationTarget>
			<MidiCCOnOffThresholds>
				<Min Value="64" />
				<Max Value="127" />
			</MidiCCOnOffThresholds>
		</On>
		<ModulationSourceCount Value="0" />
		<ParametersListWrapper LomId="0" />
		<Pointee Id="0" />
		<LastSelectedTimeableIndex Value="0" />
		<LastSelectedClipEnvelopeIndex Value="0" />
		<LastPresetRef>
			<Value />
		</LastPresetRef>
		<LockedScripts />
		<IsFolded Value="false" />
		<ShouldShowPresetName Value="true" />
		<UserName Value="" />
		<Annotation Value="" />
		<SourceContext>
			<Value />
		</SourceContext>
		<MpePitchBendUsesTuning Value="true" />
		<ViewData Value="{}" />
		<OverwriteProtectionNumber Value="3076" />
		<AudioOutputsListWrapper LomId="0" />
		<AudioInputsListWrapper LomId="0" />
		<MidiOutputsListWrapper LomId="0" />
		<MidiInputsListWrapper LomId="0" />
		<PatchSlot>
			<Value>
				<MxPatchRef Id="0">
					<FileRef>
						<RelativePathType Value="${rel ? 6 : 0}" />
						<RelativePath Value="${esc(rel)}" />
						<Path Value="${esc(abs)}" />
						<Type Value="1" />
						<LivePackName Value="" />
						<LivePackId Value="" />
						<OriginalFileSize Value="${size}" />
						<OriginalCrc Value="0" />
						<SourceHint Value="" />
					</FileRef>
					<LastModDate Value="${Math.floor(Date.now() / 1000)}" />
					<SourceContext />
					<SampleUsageHint Value="0" />
				</MxPatchRef>
			</Value>
		</PatchSlot>
		<ParameterList>
			<ParameterList />
		</ParameterList>
		<FileDropList>
			<FileDropList />
		</FileDropList>
		<IdRefList>
			<IdRefList />
		</IdRefList>
		<BlobSlot>
			<Value />
		</BlobSlot>
		<Routables>
			<InRoutings />
			<OutRoutings />
			<MidiInRoutings />
			<MidiOutRoutings />
		</Routables>
		<MpeEnabled Value="false" />
		<MpeTuningEnabled Value="false" />
	</${tag}>
</Ableton>
`;
}

function writeAdv(amxdPath, out, kind = 'midi') {
  fs.writeFileSync(out, zlib.gzipSync(Buffer.from(advXml(amxdPath, kind), 'utf8')));
  return out;
}

if (require.main === module) {
  const [amxdPath, out, kind] = process.argv.slice(2);
  if (!amxdPath || !out) { console.error('Uso: node tools/make_adv.js <ruta del .amxd> <salida.adv>'); process.exit(1); }
  console.log(`ok: ${writeAdv(amxdPath, out, kind)}`);
}

module.exports = { advXml, writeAdv };
