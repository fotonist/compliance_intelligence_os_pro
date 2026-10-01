from __future__ import annotations

PROCESS_GROUPS = (
    {
        "code": "AGR",
        "name": "Agreement Processes",
        "processes": (
            ("AGR.1", "Acquisition Process"),
            ("AGR.1A", "Acquisition preparation"),
            ("AGR.1B", "Supplier selection"),
            ("AGR.1C", "Agreement monitoring"),
            ("AGR.1D", "Acquirer acceptance"),
            ("AGR.2", "Supply"),
            ("AGR.2A", "Supplier tendering"),
            ("AGR.2B", "Contract agreement"),
            ("AGR.2C", "Product/service delivery and support"),
            ("AGR.3", "Contract change management"),
        ),
    },
    {
        "code": "ORG",
        "name": "Organizational Project-Enabling Processes",
        "processes": (
            ("ORG.1", "Life cycle model management"),
            ("ORG.1A", "Process establishment"),
            ("ORG.1B", "Process assessment"),
            ("ORG.1C", "Process improvement"),
            ("ORG.2", "Infrastructure management"),
            ("ORG.3", "Project portfolio management"),
            ("ORG.4", "Human resource management"),
            ("ORG.4A", "Skill development"),
            ("ORG.4B", "Skill acquisition and provision"),
            ("ORG.4C", "Knowledge management"),
            ("ORG.5", "Quality management"),
            ("ORG.6", "Organizational alignment"),
            ("ORG.7", "Organization management"),
        ),
    },
    {
        "code": "PRO",
        "name": "Project Processes",
        "processes": (
            ("PRO.1", "Project planning"),
            ("PRO.2", "Project assessment and control"),
            ("PRO.3", "Decision management"),
            ("PRO.4", "Risk management"),
            ("PRO.5", "Configuration management"),
            ("PRO.6", "Information Management"),
            ("PRO.7", "Measurement"),
        ),
    },
    {
        "code": "ENG",
        "name": "Technical Processes",
        "processes": (
            ("ENG.1", "Stakeholder requirements definition"),
            ("ENG.2", "System requirements analysis"),
            ("ENG.3", "System architectural design"),
            ("ENG.4", "Software implementation"),
            ("ENG.5", "System integration"),
            ("ENG.6", "System qualification testing"),
            ("ENG.7", "Software installation"),
            ("ENG.8", "Software acceptance support"),
            ("ENG.9", "Software operation"),
            ("ENG.9A", "Operational use"),
            ("ENG.9B", "Customer support"),
            ("ENG.10", "Software maintenance"),
            ("ENG.11", "Software disposal"),
        ),
    },
    {
        "code": "DEV",
        "name": "Software Implementation Processes",
        "processes": (
            ("DEV.1", "Software requirements analysis"),
            ("DEV.2", "Software architectural design"),
            ("DEV.3", "Software detailed design"),
            ("DEV.4", "Software construction"),
            ("DEV.5", "Software integration"),
            ("DEV.6", "Software qualification testing"),
        ),
    },
    {
        "code": "SUP",
        "name": "Software Support Processes",
        "processes": (
            ("SUP.1", "Software documentation management"),
            ("SUP.2", "Software configuration management"),
            ("SUP.3", "Software quality assurance"),
            ("SUP.4", "Software verification"),
            ("SUP.5", "Software validation"),
            ("SUP.6", "Software review"),
            ("SUP.7", "Software audit"),
            ("SUP.8", "Software problem resolution"),
        ),
    },
    {
        "code": "REU",
        "name": "Software Reuse Processes",
        "processes": (
            ("REU.1", "Domain engineering"),
            ("REU.2", "Reuse asset management"),
            ("REU.3", "Reuse program management"),
        ),
    },
)


def validate() -> None:
    group_codes = set()
    process_codes = set()
    process_count = 0

    for group in PROCESS_GROUPS:
        code = group["code"]

        if code in group_codes:
            raise ValueError(
                "Duplicate process group: " + code
            )

        group_codes.add(code)

        for process_code, process_name in group["processes"]:
            if process_code in process_codes:
                raise ValueError(
                    "Duplicate process: " + process_code
                )

            if not process_name.strip():
                raise ValueError(
                    "Empty process name: " + process_code
                )

            process_codes.add(process_code)
            process_count += 1

    print("GROUP_COUNT=" + str(len(group_codes)))
    print("PROCESS_COUNT=" + str(process_count))

    for group in PROCESS_GROUPS:
        print(
            group["code"]
            + "="
            + str(len(group["processes"]))
        )


if __name__ == "__main__":
    validate()
